import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '@common/redis/redis.service';
import {
  CHAT_MEDIA_CLEANUP_JOB_MARK_SOURCE_DELETED,
  CHAT_MEDIA_CLEANUP_QUEUE_NAME,
} from './chat-media-cleanup.queue.constants';
import { ChatMediaCleanupMarkSourceDeletedJobData } from './chat-media-cleanup.queue.types';

@Injectable()
export class ChatMediaCleanupQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatMediaCleanupQueueService.name);
  private readonly connection: any;
  private readonly queue: Queue;

  constructor(private readonly redisService: RedisService) {
    this.connection = this.redisService.getClient().duplicate();
    this.queue = new Queue(CHAT_MEDIA_CLEANUP_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
  }

  async enqueueMarkSourceDeleted(mediaKeys: string[]): Promise<void> {
    const uniqueMediaKeys = Array.from(
      new Set(mediaKeys.map((key) => key.trim()).filter(Boolean)),
    );

    if (!uniqueMediaKeys.length) {
      return;
    }

    try {
      await this.queue.add(CHAT_MEDIA_CLEANUP_JOB_MARK_SOURCE_DELETED, {
        mediaKeys: uniqueMediaKeys,
      } as ChatMediaCleanupMarkSourceDeletedJobData);
    } catch (error: any) {
      this.logger.warn(
        `Failed to enqueue media cleanup job: ${error?.message || 'unknown error'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
