import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { RedisService } from '@common/redis/redis.service';
import { SocketService } from '@modules/socket/socket.service';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { PostUnreadService } from '../services/post-unread.service';
import {
  POSTS_UNREAD_JOB_CREATED,
  POSTS_UNREAD_JOB_DELETED,
  POSTS_UNREAD_JOB_MARK_SEEN,
  POSTS_UNREAD_QUEUE_NAME,
} from './posts-unread.queue.constants';
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
    private readonly relationshipService: RelationshipService,
    private readonly postUnreadService: PostUnreadService,
    private readonly socketService: SocketService,
  ) {
    this.connection = this.redisService.getClient().duplicate();
  }

  onModuleInit(): void {
    this.worker = new Worker(
      POSTS_UNREAD_QUEUE_NAME,
      async (job: Job) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: 5,
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
    await Promise.all(
      friendIds.map(async (friendId) => {
        const { count, seq } =
          await this.postUnreadService.incrementUnreadForUser(friendId);
        this.socketService.emitToUser(friendId, POSTS_UNREAD_UPDATED_EVENT, {
          count,
          seq,
        });
      }),
    );
  }

  private async handleDeleted(data: PostUnreadDeletedJobData): Promise<void> {
    await this.postUnreadService.applyPostDeleteSideEffects(data.authorId);
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
