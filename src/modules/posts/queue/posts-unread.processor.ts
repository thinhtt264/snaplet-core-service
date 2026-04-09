import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { RedisService } from '@common/redis/redis.service';
import { SocketService } from '@modules/socket/socket.service';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { PostUnreadService } from '../services/post-unread.service';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import {
  POSTS_UNREAD_JOB_CREATED,
  POSTS_UNREAD_JOB_DELETED,
  POSTS_UNREAD_JOB_MARK_SEEN,
  POSTS_UNREAD_QUEUE_NAME,
} from './posts-unread.queue.constants';
import { NotificationQueueService } from '@modules/notifications/queue/notification-queue.service';
import { NotificationType } from '@modules/notifications/constants/notification.constants';
import {
  type PostUnreadCreatedJobData,
  type PostUnreadDeletedJobData,
  type PostUnreadMarkSeenJobData,
} from './posts-unread.queue.types';
import { POSTS_UNREAD_UPDATED_EVENT } from '@modules/socket/events/socket-events';

@Injectable()
export class PostsUnreadProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostsUnreadProcessor.name);
  private worker: Worker | null = null;
  private readonly connection: any;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly relationshipService: RelationshipService,
    private readonly postUnreadService: PostUnreadService,
    private readonly socketService: SocketService,
    private readonly cacheService: CacheService,
    private readonly notificationQueueService: NotificationQueueService,
  ) {
    this.connection = this.redisService.getClient().duplicate();
  }

  onModuleInit(): void {
    const drainDelaySeconds = this.configService.get<number>(
      'postsUnread.worker.drainDelaySeconds',
    );
    const lockDurationMs = this.configService.get<number>(
      'postsUnread.worker.lockDurationMs',
    );
    const stalledIntervalMs = this.configService.get<number>(
      'postsUnread.worker.stalledIntervalMs',
    );

    this.worker = new Worker(
      POSTS_UNREAD_QUEUE_NAME,
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
      this.logger.warn(`Posts unread worker error: ${error.message}`);
    });
  }

  private async processJob(job: Job): Promise<void> {
    switch (job.name) {
      case POSTS_UNREAD_JOB_CREATED:
        await this.handleCreated(job.data as PostUnreadCreatedJobData);
        return;
      case POSTS_UNREAD_JOB_DELETED:
        await this.handleDeleted(job.data as PostUnreadDeletedJobData);
        return;
      case POSTS_UNREAD_JOB_MARK_SEEN:
        await this.handleMarkSeen(job.data as PostUnreadMarkSeenJobData);
        return;
      default:
        this.logger.warn(`Unknown posts unread job: ${String(job.name)}`);
    }
  }

  private async handleCreated(data: PostUnreadCreatedJobData): Promise<void> {
    const friendIds = await this.relationshipService.getMyFriendIds(
      data.authorId,
    );

    if (friendIds.length <= 0) {
      return;
    }

    await Promise.all(
      friendIds.map(async (friendId) => {
        const { count, seq } =
          await this.postUnreadService.incrementUnreadForUser(friendId);
        this.socketService.emitToUser(friendId, POSTS_UNREAD_UPDATED_EVENT, {
          count,
          seq,
        });
        await this.notificationQueueService.addWidgetRefreshPushJob({
          recipientUserId: friendId,
          type: NotificationType.WIDGET_REFRESH,
        });
      }),
    );

    await this.cacheService.invalidateMany(
      REDIS_KEY_FEATURES.POST_ACTIVITY_CACHE,
      friendIds,
    );
  }

  private async handleDeleted(data: PostUnreadDeletedJobData): Promise<void> {
    await this.postUnreadService.applyPostDeleteSideEffects(data.authorId);

    const friendIds = await this.relationshipService.getMyFriendIds(
      data.authorId,
    );
    if (friendIds.length > 0) {
      await this.cacheService.invalidateMany(
        REDIS_KEY_FEATURES.POST_ACTIVITY_CACHE,
        friendIds,
      );
    }
  }

  private async handleMarkSeen(data: PostUnreadMarkSeenJobData): Promise<void> {
    await this.postUnreadService.applyMarkSeen(
      data.userId,
      data.lastSeenPostCreatedAt,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.connection.quit();
  }
}
