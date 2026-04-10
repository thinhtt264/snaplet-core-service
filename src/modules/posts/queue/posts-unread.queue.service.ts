import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '@common/redis/redis.service';
import {
  POSTS_UNREAD_JOB_CREATED,
  POSTS_UNREAD_JOB_DELETED,
  POSTS_UNREAD_JOB_MARK_SEEN,
  POSTS_UNREAD_QUEUE_NAME,
  type PostsUnreadJobName,
} from './posts-unread.queue.constants';
import {
  type PostUnreadCreatedJobData,
  type PostUnreadDeletedJobData,
  type PostUnreadMarkSeenJobData,
} from './posts-unread.queue.types';

@Injectable()
export class PostsUnreadQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PostsUnreadQueueService.name);
  private readonly connection: any;
  private readonly queue: Queue;

  constructor(private readonly redisService: RedisService) {
    this.connection = this.redisService.getClient().duplicate();
    this.queue = new Queue(POSTS_UNREAD_QUEUE_NAME, {
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

  async enqueuePostCreated(
    authorId: string,
    recipientUserIds: string[],
  ): Promise<void> {
    await this.enqueue(POSTS_UNREAD_JOB_CREATED, { authorId, recipientUserIds });
  }

  async enqueuePostDeleted(
    authorId: string,
    recipientUserIds: string[],
  ): Promise<void> {
    await this.enqueue(POSTS_UNREAD_JOB_DELETED, { authorId, recipientUserIds });
  }

  async enqueueMarkSeen(
    userId: string,
    lastSeenPostCreatedAt: string,
  ): Promise<void> {
    await this.enqueue(POSTS_UNREAD_JOB_MARK_SEEN, {
      userId,
      lastSeenPostCreatedAt,
    });
  }

  private async enqueue(
    name: PostsUnreadJobName,
    data:
      | PostUnreadCreatedJobData
      | PostUnreadDeletedJobData
      | PostUnreadMarkSeenJobData,
  ): Promise<void> {
    try {
      await this.queue.add(name, data);
    } catch (error: any) {
      this.logger.warn(
        `Failed to enqueue ${name}: ${error?.message || 'unknown error'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
