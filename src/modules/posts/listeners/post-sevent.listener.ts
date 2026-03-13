import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { RedisService } from '@common/redis/redis.service';
import { CacheService } from '@modules/cache/cache.service';
import { PostSseService } from '../services/post-sse.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { POST_SSE_EVENTS } from '@common/constants/event-names.constants';
import { SseEventType } from '@common/constants/sse-event-type.constants';

// Keep session-scoped unread/seq keys for a limited time to avoid Redis garbage
const POSTS_SESSION_TTL_SECONDS = 3 * 24 * 60 * 60; // 7 days

type PostCreatedEvent = {
  postId: string;
  authorId: string;
};

@Injectable()
export class PostEventListener {
  private readonly logger = new Logger(PostEventListener.name);

  constructor(
    private readonly relationshipService: RelationshipService,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
    private readonly postSseService: PostSseService,
  ) {}

  /**
   * Handle post.created SSE events:
   * - Compute friend IDs of author
   * - For connected friends, increment unread + seq in Redis using Promise.all
   * - Push SSE payload { type: 'posts_update', seq, count }
   */
  @OnEvent(POST_SSE_EVENTS.POST_CREATED)
  async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    const friendIds = await this.relationshipService.getMyFriendIds(
      event.authorId,
    );

    if (!friendIds.length) {
      this.logger.log(
        `No friends found for authorId=${event.authorId}, skipping SSE`,
      );
      return;
    }

    // Clear unread cache for all friends (online + offline) in the background
    setImmediate(() => {
      this.cacheService.invalidateMany(
        REDIS_KEY_FEATURES.POSTS_CACHE_UNREAD,
        friendIds,
      );
    });

    // SSE push for friends that are currently online
    await Promise.all(
      friendIds.map(async (friendId) => {
        if (!this.postSseService.hasConnection(friendId)) {
          this.logger.log(
            `Friend has no active SSE connection, skipping SSE friendId=${friendId}`,
          );
          return;
        }

        const unreadKey = `${REDIS_KEY_FEATURES.POSTS_SESSION_UNREAD}:${friendId}`;
        const seqKey = `${REDIS_KEY_FEATURES.POSTS_SESSION_SEQ}:${friendId}`;

        const [count, seq] = await Promise.all([
          this.redisService.incr(unreadKey),
          this.redisService.incr(seqKey),
        ]);

        // Refresh TTL so session keys are automatically cleaned up after inactivity
        void Promise.all([
          this.redisService.expire(unreadKey, POSTS_SESSION_TTL_SECONDS),
          this.redisService.expire(seqKey, POSTS_SESSION_TTL_SECONDS),
        ]);

        this.postSseService.emitPostsUpdate(
          friendId,
          SseEventType.POSTS_UPDATE,
          {
            seq,
            count,
          },
        );

        this.logger.log(
          `Emitted posts_update for friendId=${friendId} seq=${seq} count=${count}`,
        );
      }),
    );
  }
}
