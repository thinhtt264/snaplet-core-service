import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import {
  GetPostsResponse,
  PostResponse,
} from '../interfaces/post-response.interface';
import { RawPostFromAggregation } from '../interfaces/post-repository.interface';
import { PostVisibility } from '../schemas/post.schema';
import { parseCursor, encodeCursor } from '../types/feed-cursor.types';
import { PostRepository } from '../repositories/post.repository';
import { MediaService } from '@modules/media/services/media.service';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { UserService } from '@modules/users/services/user.service';
import { CacheService } from '@modules/cache/cache.service';
import { RedisService } from '@common/redis/redis.service';
import { buildRedisKey } from '@common/utils/redis.utils';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { ImageSizeKey } from '@common/types';
import { POST_CREATED_EVENT, PostCreatedEvent } from '../events/post-events';

const POST_LAST_SEEN_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days
const POST_UNREAD_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days
const POST_SESSION_UNREAD_TTL_SECONDS = 3 * 24 * 60 * 60; // 3 days

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly mediaService: MediaService,
    private readonly relationshipService: RelationshipService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getPostsFeed(
    userId: string,
    limit: number = 10,
    cursor?: string,
  ): Promise<GetPostsResponse> {
    try {
      const userObjectId = new Types.ObjectId(userId);

      // Get my accepted friend IDs (lightweight query, optimized for filtering)
      const acceptedFriendIds =
        await this.relationshipService.getMyFriendIds(userId);

      const friendUserIds = acceptedFriendIds.map(
        (id) => new Types.ObjectId(id),
      );

      const userIds = [userObjectId, ...friendUserIds];

      if (userIds.length === 0) {
        return {
          data: [],
          pagination: { limit, nextCursor: null },
        };
      }

      const parsedCursor = parseCursor(cursor);
      const result = await this.postRepository.findPostsWithCursor({
        userIds,
        limit,
        cursor: parsedCursor,
      });

      const nextCursor = result.nextCursor
        ? encodeCursor(result.nextCursor)
        : null;

      return {
        data: this.transformPosts(result.posts, userId),
        pagination: {
          limit,
          nextCursor,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch posts feed',
      );
    }
  }

  /**
   * Create a new post
   */
  async createPost(
    userId: string,
    mediaIds: string[],
    caption?: string,
    visibility?: PostVisibility,
  ): Promise<{ id: string; createdAt: Date }> {
    await this.mediaService.assertMediaReadyAndOwned(mediaIds, userId);

    const post = await this.postRepository.create({
      userId: new Types.ObjectId(userId),
      mediaIds: mediaIds.map((id) => new Types.ObjectId(id)),
      caption: caption ?? '',
      visibility: visibility ?? PostVisibility.FRIEND_ONLY,
    });

    setImmediate(() => {
      this.eventEmitter.emit(POST_CREATED_EVENT, {
        authorId: userId,
        postCreatedAt: post.createdAt,
      } as PostCreatedEvent);
    });

    return {
      id: post._id.toString(),
      createdAt: post.createdAt,
    };
  }

  /**
   * GET /posts/unread-count
   * 1. No last_seen key → return 0 (no DB)
   * 2. getOrCompute: cache hit → return count; miss → query DB, set cache, return count
   */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const lastSeenRaw = await this.cacheService.get<string>(
      REDIS_KEY_FEATURES.POST_UNREAD_LAST_SEEN_CACHE,
      userId,
    );
    if (!lastSeenRaw) {
      return { count: 0 };
    }

    const count = await this.cacheService.getOrCompute(
      REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
      userId,
      async () => {
        const friendIds = await this.relationshipService.getMyFriendIds(userId);
        const friendObjectIds = friendIds.map((id) => new Types.ObjectId(id));
        const lastSeenAt = new Date(lastSeenRaw);
        return this.postRepository.countPostsByFriendCreatedAfter(
          friendObjectIds,
          lastSeenAt,
        );
      },
      POST_UNREAD_CACHE_TTL_SECONDS,
    );

    return { count };
  }

  private getSessionUnreadKeys(userId: string): {
    countKey: string;
    seqKey: string;
  } {
    return {
      countKey: buildRedisKey(
        REDIS_KEY_FEATURES.POST_UNREAD_SESSION,
        `${userId}:count`,
      ),
      seqKey: buildRedisKey(
        REDIS_KEY_FEATURES.POST_UNREAD_SESSION,
        `${userId}:seq`,
      ),
    };
  }

  /**
   * Delete session unread keys for user (WS connect/reconnect and mark-seen).
   */
  async deleteSessionUnread(userId: string): Promise<void> {
    const { countKey, seqKey } = this.getSessionUnreadKeys(userId);
    await this.redisService.del([countKey, seqKey]);
  }

  /**
   * Increment session unread count and seq atomically, TTL 3 days. Used when a friend creates a post (WS).
   */
  async incrSessionUnread(
    userId: string,
  ): Promise<{ count: number; seq: number }> {
    const { countKey, seqKey } = this.getSessionUnreadKeys(userId);
    const redis = this.redisService.getClient();
    const multi = redis.multi();
    multi.incr(countKey);
    multi.incr(seqKey);
    multi.expire(countKey, POST_SESSION_UNREAD_TTL_SECONDS);
    multi.expire(seqKey, POST_SESSION_UNREAD_TTL_SECONDS);
    const results = await multi.exec();
    if (!results) {
      return { count: 0, seq: 0 };
    }
    const count = Number(results[0]?.[1] ?? 0);
    const seq = Number(results[1]?.[1] ?? 0);
    return { count, seq };
  }

  /**
   * POST /posts/mark-seen — respond 200 immediately, then setImmediate for keys.
   */
  markSeen(userId: string, lastSeenPostCreatedAt: string) {
    setImmediate(() => this.applyMarkSeen(userId, lastSeenPostCreatedAt));
  }

  private async applyMarkSeen(
    userId: string,
    lastSeenPostCreatedAt: string,
  ): Promise<void> {
    const { countKey: sessionCountKey, seqKey: sessionSeqKey } =
      this.getSessionUnreadKeys(userId);

    const currentLastSeen = await this.cacheService.get<string>(
      REDIS_KEY_FEATURES.POST_UNREAD_LAST_SEEN_CACHE,
      userId,
    );

    await Promise.all([
      this.cacheService.set(
        REDIS_KEY_FEATURES.POST_UNREAD_LAST_SEEN_CACHE,
        userId,
        lastSeenPostCreatedAt,
        POST_LAST_SEEN_TTL_SECONDS,
      ),
      this.redisService.del([sessionCountKey, sessionSeqKey]),
      currentLastSeen !== lastSeenPostCreatedAt
        ? this.cacheService.invalidate(
            REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
            userId,
          )
        : Promise.resolve(),
    ]);
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    try {
      const post = await this.postRepository.findPostById(
        new Types.ObjectId(postId),
      );
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      if (post.userId.toString() !== userId) {
        throw new ForbiddenException('You are not the owner of this post');
      }

      await this.postRepository.hardDeletePost(new Types.ObjectId(postId));
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to delete post',
      );
    }
  }

  /**
   * Transform raw aggregation data to response
   */
  private transformPosts(
    posts: RawPostFromAggregation[],
    userId: string,
  ): PostResponse[] {
    // Only include md and xl sizes for posts feed
    const postImageSizes = [ImageSizeKey.MD, ImageSizeKey.XL];

    return posts.map((post) => {
      const avatarUrls = this.userService.getAvatarUrlsForKey(
        post.user.avatarKey,
        { sizes: [ImageSizeKey.XS] },
      );
      return {
        id: post._id.toString(),
        userId: post.userId.toString(),
        username: post.user.username,
        firstName: post.user.firstName,
        lastName: post.user.lastName,
        avatarUrls,
        media: post.media.map((m) => ({
          id: m._id.toString(),
          ownerId: m.ownerId.toString(),
          mimeType: m.mimeType,
          images: this.mediaService.getImageSizesForKey(m.mediaKey, {
            sizes: postImageSizes,
          }),
          duration: m.duration,
          transform: m.transform,
          status: m.status,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        caption: post.caption,
        visibility: post.visibility,
        createdAt: post.createdAt,
        isOwnPost: post.userId.toString() === userId,
      };
    });
  }
}
