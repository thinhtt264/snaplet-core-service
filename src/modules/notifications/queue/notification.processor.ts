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
import type { ReactionPushJobData } from '../dto/push-notification.dto';
import { FcmService } from '../services/fcm.service';

@Injectable()
export class NotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProcessor.name);
  private worker: Worker | null = null;
  private readonly connection: any;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly fcmService: FcmService,
    private readonly userRepository: UserRepository,
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
      default:
        this.logger.warn(`Unknown notification job: ${String(job.name)}`);
    }
  }

  private async handleReactionPush(data: ReactionPushJobData): Promise<void> {
    const {
      postOwnerId,
      postId,
      reactorDisplayName,
      actorAvatarUrl,
      reactionIcon,
    } = data;

    const fcmToken = await this.userRepository.findFcmToken(postOwnerId);
    if (!fcmToken) {
      this.logger.debug(`No FCM token for user ${postOwnerId}, skipping`);
      return;
    }

    const result = await this.fcmService.sendPush({
      token: fcmToken,
      title: `${reactorDisplayName} reacted to your post`,
      body: reactionIcon,
      data: {
        type: NotificationType.POST_REACTION,
        postId: String(postId),
        actorAvatarUrl: actorAvatarUrl ?? '',
      },
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
}
