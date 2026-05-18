import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '@common/redis/redis.service';
import {
  NOTIFICATION_QUEUE_NAME,
  NotificationJobName,
  NotificationType,
} from '../constants/notification.constants';
import type {
  ChatFcmPushJobData,
  ReactionPushJobData,
  WidgetRefreshPushJobData,
} from '../dto/push-notification.dto';
import { assertUnreachable } from '../utils/assert-unreachable.util';

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly connection: any;
  private readonly queue: Queue;

  constructor(private readonly redisService: RedisService) {
    this.connection = this.redisService.getClient().duplicate();
    this.queue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  }

  async addReactionPushJob(data: ReactionPushJobData): Promise<void> {
    try {
      await this.queue.add(NotificationJobName.PUSH_REACTION, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        jobId: `reaction-${data.postId}-${data.reactorId}`,
        removeOnComplete: true,
        removeOnFail: 100,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'unknown enqueue error';
      this.logger.warn(`Failed to enqueue reaction push: ${message}`);
    }
  }

  async addChatFcmJob(data: ChatFcmPushJobData): Promise<void> {
    try {
      const dedupeKey = this.buildChatFcmJobId(data);
      await this.queue.add(NotificationJobName.PUSH_CHAT_FCM, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        jobId: dedupeKey,
        removeOnComplete: true,
        removeOnFail: 100,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'unknown enqueue error';
      this.logger.warn(`Failed to enqueue chat FCM push: ${message}`);
    }
  }

  async addWidgetRefreshPushJob(data: WidgetRefreshPushJobData): Promise<void> {
    try {
      await this.queue.add(NotificationJobName.PUSH_WIDGET_REFRESH, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        jobId: `widget-refresh-${data.recipientUserId}`,
        removeOnComplete: true,
        removeOnFail: 100,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'unknown enqueue error';
      this.logger.warn(`Failed to enqueue widget refresh push: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }

  private buildChatFcmJobId(data: ChatFcmPushJobData): string {
    const { recipientUserId, payload } = data;
    switch (payload.type) {
      case NotificationType.NEW_CHAT_MESSAGE:
        return `chat-msg-${payload.messageId}-${recipientUserId}`;
      case NotificationType.NEW_MESSAGE_REACTION:
        return `chat-react-${payload.messageId}-${recipientUserId}-${payload.emoji}`;
    }
    return assertUnreachable(payload);
  }
}
