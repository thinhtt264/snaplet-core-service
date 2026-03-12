import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { RedisService } from '@common/redis/redis.service';
import { CacheService } from '@modules/cache/cache.service';
import { PostSseService } from '../services/post-sse.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { POST_SSE_EVENTS } from '@common/constants/event-names.constants';

type PostCreatedEvent = {
  postId: string;
  authorId: string;
};

@Injectable()
export class PostEventListener {
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
          return;
        }

        const [count, seq] = await Promise.all([
          this.redisService.incr(
            `${REDIS_KEY_FEATURES.POSTS_SESSION_UNREAD}:${friendId}`,
          ),
          this.redisService.incr(
            `${REDIS_KEY_FEATURES.POSTS_SESSION_SEQ}:${friendId}`,
          ),
        ]);

        this.postSseService.emitPostsUpdate(friendId, {
          type: 'posts_update',
          seq,
          count,
        });
      }),
    );
  }
}
