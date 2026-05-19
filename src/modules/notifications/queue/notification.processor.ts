import {
  forwardRef,
  Inject,
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
  ChatFcmJobPayload,
  ChatFcmPushJobData,
  CustomPushJobData,
  ReactionPushJobData,
  WidgetRefreshPushJobData,
} from '../dto/push-notification.dto';
import { FcmService } from '../services/fcm.service';
import {
  serializePayload,
  type ChatNotificationPayload,
} from '../dto/fcm-payload.dto';
import { UserService } from '@modules/users/services/user.service';
import { ConversationRepository } from '@modules/chat/repositories/conversation.repository';
import { ChatGateway } from '@modules/chat/gateway/chat.gateway';
import { assertUnreachable } from '../utils/assert-unreachable.util';

@Injectable()
export class NotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProcessor.name);
  private worker: Worker | null = null;
  private readonly connection: any;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly fcmService: FcmService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
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
      case NotificationJobName.PUSH_CUSTOM:
        await this.handleCustomPush(job.data as CustomPushJobData);
        return;
      default:
        this.logger.warn(`Unknown notification job: ${String(job.name)}`);
    }
  }

  private async handleReactionPush(data: ReactionPushJobData): Promise<void> {
    const {
      postOwnerId,
      deeplink,
      reactorId,
      reactorDisplayName,
      largeIconUrl,
      reactionIcon,
    } = data;

    const fcmToken = await this.userRepository.findFcmToken(postOwnerId);
    if (!fcmToken) {
      this.logger.debug(`No FCM token for user ${postOwnerId}, skipping`);
      return;
    }

    this.logger.log(
      `Sending reaction notification: reactorUserId=${reactorId}, recipientUserId=${postOwnerId}, deeplink=${deeplink}`,
    );

    const result = await this.fcmService.sendPush({
      token: fcmToken,
      title: `${reactorDisplayName} reacted to your post`,
      body: reactionIcon,
      data: this.buildNotificationData(data.type, {
        deeplink,
        largeIconUrl: largeIconUrl ?? '',
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
        deeplink: '',
        largeIconUrl: '',
      }),
    });

    if (result.shouldDeleteToken) {
      this.logger.log(
        `Clearing invalid FCM token for user ${data.recipientUserId}`,
      );
      await this.userRepository.updateFcmToken(data.recipientUserId, null);
    }
  }

  private async handleCustomPush(data: CustomPushJobData): Promise<void> {
    const fcmToken = await this.userRepository.findFcmToken(
      data.recipientUserId,
    );
    if (!fcmToken) {
      this.logger.debug(
        `No FCM token for user ${data.recipientUserId}, skipping custom push`,
      );
      return;
    }

    this.logger.log(
      `Sending custom push: recipientUserId=${data.recipientUserId}, deeplink=${data.deeplink}`,
    );

    const result = await this.fcmService.sendPush({
      token: fcmToken,
      title: data.title,
      body: data.body,
      data: {
        type: data.type,
        deeplink: data.deeplink,
        largeIconUrl: data.largeIconUrl ?? '',
      },
    });

    this.logger.log(
      `Custom push result: success=${result.success}, shouldDeleteToken=${result.shouldDeleteToken}`,
    );

    if (result.shouldDeleteToken) {
      await this.userRepository.updateFcmToken(data.recipientUserId, null);
    }
  }

  private async handleChatFcmPush(data: ChatFcmPushJobData): Promise<void> {
    const { recipientUserId, payload } = data;

    const inConversationRoom =
      await this.chatGateway.isUserPresentInConversationRoom(
        recipientUserId,
        payload.conversationId,
      );
    if (inConversationRoom) {
      this.logger.debug(
        `Skipping chat FCM (${payload.type}): recipient ${recipientUserId} is in conv:${payload.conversationId} (/chat)`,
      );
      return;
    }

    if (payload.type === NotificationType.NEW_CHAT_MESSAGE) {
      const alreadyRead =
        await this.conversationRepository.hasRecipientReadMessage(
          payload.conversationId,
          recipientUserId,
          payload.messageId,
        );
      if (alreadyRead) {
        this.logger.debug(
          `Skipping chat FCM (NEW_CHAT_MESSAGE): recipient ${recipientUserId} already read message ${payload.messageId}`,
        );
        return;
      }
    }

    const fcmToken = await this.userRepository.findFcmToken(recipientUserId);
    if (!fcmToken) {
      this.logger.debug(
        `No FCM token for user ${recipientUserId}, skipping chat FCM push`,
      );
      return;
    }

    const actorUserId = this.resolveChatActorUserId(payload);
    const actor = await this.userRepository.findActiveById(actorUserId);
    const actorName = this.resolveDisplayName(actor);
    const actorAvatarUrl = actor
      ? this.userService.getAvatarUrlsForKey(actor.avatarKey, {
          sizes: [],
        }).original
      : '';
    const fcmPayload = this.buildChatFcmPayload(
      payload,
      actorName,
      actorAvatarUrl,
    );

    const result = await this.fcmService.sendPush({
      token: fcmToken,
      title: '',
      body: '',
      data: serializePayload(fcmPayload),
    });

    this.logger.debug(`FCM send result: ${result.success}`);

    if (result.shouldDeleteToken) {
      await this.userRepository.updateFcmToken(recipientUserId, null);
    }
  }

  private resolveChatActorUserId(payload: ChatFcmJobPayload): string {
    switch (payload.type) {
      case NotificationType.NEW_CHAT_MESSAGE:
        return payload.senderUserId;
      case NotificationType.NEW_MESSAGE_REACTION:
        return payload.reactorUserId;
      default:
        return assertUnreachable(payload);
    }
  }

  private buildChatFcmPayload(
    payload: ChatFcmJobPayload,
    actorName: string,
    actorAvatarUrl: string,
  ): ChatNotificationPayload {
    switch (payload.type) {
      case NotificationType.NEW_CHAT_MESSAGE:
        return {
          type: NotificationType.NEW_CHAT_MESSAGE,
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          senderName: actorName,
          senderAvatarUrl: actorAvatarUrl,
          ...(payload.text ? { text: payload.text.slice(0, 100) } : {}),
          hasImage: String(payload.hasImage),
        };
      case NotificationType.NEW_MESSAGE_REACTION:
        return {
          type: NotificationType.NEW_MESSAGE_REACTION,
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          reactorName: actorName,
          reactorAvatarUrl: actorAvatarUrl,
          emoji: payload.emoji,
        };
      default:
        return assertUnreachable(payload);
    }
  }

  private buildNotificationData(
    type: NotificationType,
    context: { deeplink: string; largeIconUrl: string },
  ): Record<string, string> {
    switch (type) {
      case NotificationType.WIDGET_REFRESH:
        return { type };
      case NotificationType.CUSTOM:
      default:
        return {
          type,
          deeplink: context.deeplink,
          largeIconUrl: context.largeIconUrl,
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
