import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { RedisService } from '@common/redis/redis.service';
import { UserRepository } from '@modules/users/repositories/user.repository';
import {
  NOTIFICATION_QUEUE_NAME,
  NotificationJobName,
  NotificationType,
} from '../constants/notification.constants';
import type {
  ReactionPushJobData,
  WidgetRefreshPushJobData,
} from '../dto/push-notification.dto';
import { FcmService } from '../services/fcm.service';
import { SocketService } from '@modules/socket/socket.service';
import type { ChatFcmPushJobData } from '../dto/push-notification.dto';
import {
  serializePayload,
  type NewChatMessagePayload,
  type NewMessageReactionPayload,
} from '../dto/fcm-payload.dto';
import { UserService } from '@modules/users/services/user.service';
import { ConversationRepository } from '@modules/chat/repositories/conversation.repository';

@Injectable()
export class NotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProcessor.name);
  private worker: Worker | null = null;
  private readonly connection: any;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly fcmService: FcmService,
    private readonly socketService: SocketService,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    private readonly conversationRepository: ConversationRepository,
  ) {
    this.connection = this.redisService.getClient().duplicate();
  }

  onModuleInit(): void {
    const drainDelaySeconds = this.configService.get<number>(
      'notifications.worker.drainDelaySeconds',
    );
    const lockDurationMs = this.configService.get<number>(
      'notifications.worker.lockDurationMs',
    );
    const stalledIntervalMs = this.configService.get<number>(
      'notifications.worker.stalledIntervalMs',
    );

    this.worker = new Worker(
      NOTIFICATION_QUEUE_NAME,
      async (job: Job) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: 5,
        drainDelay:
          typeof drainDelaySeconds === 'number' && drainDelaySeconds > 0
            ? drainDelaySeconds
            : undefined,
        lockDuration:
          typeof lockDurationMs === 'number' && lockDurationMs > 0
            ? lockDurationMs
            : undefined,
        stalledInterval:
          typeof stalledIntervalMs === 'number' && stalledIntervalMs > 0
            ? stalledIntervalMs
            : undefined,
      },
    );

    this.worker.on('error', (error) => {
      this.logger.warn(`Notification worker error: ${error.message}`);
    });
  }

  private async processJob(job: Job): Promise<void> {
    switch (job.name) {
      case NotificationJobName.PUSH_REACTION:
        await this.handleReactionPush(job.data as ReactionPushJobData);
        return;
      case NotificationJobName.PUSH_WIDGET_REFRESH:
        await this.handleWidgetRefreshPush(
          job.data as WidgetRefreshPushJobData,
        );
        return;
      case NotificationJobName.PUSH_CHAT_FCM:
        await this.handleChatFcmPush(job.data as ChatFcmPushJobData);
        return;
      default:
        this.logger.warn(`Unknown notification job: ${String(job.name)}`);
    }
  }

  private async handleReactionPush(data: ReactionPushJobData): Promise<void> {
    const {
      postOwnerId,
      postId,
      reactorId,
      reactorDisplayName,
      actorAvatarUrl,
      reactionIcon,
    } = data;

    const fcmToken = await this.userRepository.findFcmToken(postOwnerId);
    if (!fcmToken) {
      this.logger.debug(`No FCM token for user ${postOwnerId}, skipping`);
      return;
    }

    this.logger.log(
      `Sending reaction notification: reactorUserId=${reactorId}, recipientUserId=${postOwnerId}, postId=${postId}`,
    );

    const result = await this.fcmService.sendPush({
      token: fcmToken,
      title: `${reactorDisplayName} reacted to your post`,
      body: reactionIcon,
      data: this.buildNotificationData(data.type, {
        postId: String(postId),
        actorAvatarUrl: actorAvatarUrl ?? '',
      }),
    });

    if (result.shouldDeleteToken) {
      this.logger.log(`Clearing invalid FCM token for user ${postOwnerId}`);
      await this.userRepository.updateFcmToken(postOwnerId, null);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.connection.quit();
  }

  private async handleWidgetRefreshPush(
    data: WidgetRefreshPushJobData,
  ): Promise<void> {
    const fcmToken = await this.userRepository.findFcmToken(
      data.recipientUserId,
    );
    if (!fcmToken) {
      this.logger.debug(
        `No FCM token for user ${data.recipientUserId}, skipping widget refresh`,
      );
      return;
    }

    const result = await this.fcmService.sendPush({
      token: fcmToken,
      title: '',
      body: '',
      data: this.buildNotificationData(data.type, {
        postId: '',
        actorAvatarUrl: '',
      }),
    });

    if (result.shouldDeleteToken) {
      this.logger.log(
        `Clearing invalid FCM token for user ${data.recipientUserId}`,
      );
      await this.userRepository.updateFcmToken(data.recipientUserId, null);
    }
  }

  private async handleChatFcmPush(data: ChatFcmPushJobData): Promise<void> {
    const { recipientUserId, payload } = data;

    if (this.socketService.isUserConnected(recipientUserId)) {
      this.logger.debug(
        `Skipping chat FCM: recipient ${recipientUserId} is online (socket)`,
      );
      return;
    }

    const alreadyRead =
      await this.conversationRepository.hasRecipientReadMessage(
        payload.conversationId,
        recipientUserId,
        payload.messageId,
      );
    if (alreadyRead) {
      return;
    }

    const fcmToken = await this.userRepository.findFcmToken(recipientUserId);
    if (!fcmToken) {
      this.logger.debug(
        `No FCM token for user ${recipientUserId}, skipping chat FCM push`,
      );
      return;
    }

    const actorUserId =
      payload.type === 'NEW_CHAT_MESSAGE'
        ? payload.senderUserId
        : payload.reactorUserId;
    const actor = await this.userRepository.findActiveById(actorUserId);
    const actorName = this.resolveDisplayName(actor);
    const actorAvatarUrl = actor
      ? this.userService.getAvatarUrlsForKey(actor.avatarKey, {
          sizes: [],
        }).original
      : '';
    const fcmPayload: NewChatMessagePayload | NewMessageReactionPayload =
      payload.type === 'NEW_CHAT_MESSAGE'
        ? {
            type: 'NEW_CHAT_MESSAGE',
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            senderName: actorName,
            senderAvatarUrl: actorAvatarUrl,
            ...(payload.text ? { text: payload.text.slice(0, 100) } : {}),
            hasImage: String(payload.hasImage),
          }
        : {
            type: 'NEW_MESSAGE_REACTION',
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            reactorName: actorName,
            reactorAvatarUrl: actorAvatarUrl,
            emoji: payload.emoji,
          };

    const result = await this.fcmService.sendPush({
      token: fcmToken,
      title: '',
      body: '',
      data: serializePayload(fcmPayload),
    });

    if (result.shouldDeleteToken) {
      await this.userRepository.updateFcmToken(recipientUserId, null);
    }
  }

  private buildNotificationData(
    type: NotificationType,
    context: { postId: string; actorAvatarUrl: string },
  ): Record<string, string> {
    switch (type) {
      case NotificationType.WIDGET_REFRESH:
        return { type };
      case NotificationType.POST_REACTION:
      default:
        return {
          type,
          postId: context.postId,
          actorAvatarUrl: context.actorAvatarUrl,
        };
    }
  }

  private resolveDisplayName(
    user: {
      firstName: string;
      lastName: string;
      username: string | null;
    } | null,
  ): string {
    if (!user) return 'Someone';
    const full = `${user.firstName} ${user.lastName}`.trim();
    if (full) return full;
    if (user.username) return user.username;
    return 'Someone';
  }
}
