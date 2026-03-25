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
  PostActivityResponse,
  PostResponse,
} from '../interfaces/post-response.interface';
import { RawPostFromAggregation } from '../interfaces/post-repository.interface';
import { PostVisibility } from '../schemas/post.schema';
import { parseCursor, encodeCursor } from '../types/feed-cursor.types';
import { PostRepository } from '../repositories/post.repository';
import { MediaService } from '@modules/media/services/media.service';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { UserService } from '@modules/users/services/user.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { ImageSizeKey } from '@common/types';
import { POST_CREATED_EVENT, PostCreatedEvent } from '../events/post-events';
import {
  POST_UNREAD_CACHE_TTL_SECONDS,
  POST_UNREAD_COUNT_MAX,
} from '../constants/post-unread.constants';
import { PostUnreadService } from './post-unread.service';
import { PostsUnreadQueueService } from '../queue/posts-unread.queue.service';
import { GetNewerFeedDto } from '../dto/get-newer-feed.dto';
import { CacheService } from '@modules/cache/cache.service';

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly mediaService: MediaService,
    private readonly relationshipService: RelationshipService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly postUnreadService: PostUnreadService,
    private readonly postsUnreadQueueService: PostsUnreadQueueService,
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

  async getNewerFeed(
    userId: string,
    dto: GetNewerFeedDto,
  ): Promise<PostResponse[]> {
    const since = new Date(dto.since);
    const limit = dto.limit ?? 1;

    // Avoid pointless queries for future timestamps
    if (since > new Date()) {
      return [];
    }

    const friendIds = await this.relationshipService.getMyFriendIds(userId);
    if (friendIds.length === 0) {
      return [];
    }

    const friendObjectIds = friendIds.map((id) => new Types.ObjectId(id));
    const posts = await this.postRepository.findNewer({
      friendIds: friendObjectIds,
      since,
      limit,
    });

    return this.transformPosts(posts, userId);
  }

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

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.cacheService.getOrCompute<number>(
      REDIS_KEY_FEATURES.POST_UNREAD_COUNT_CACHE,
      userId,
      async () => {
        const lastSeenRaw = await this.cacheService.get<string>(
          REDIS_KEY_FEATURES.POST_UNREAD_LAST_SEEN_CACHE,
          userId,
        );
        if (!lastSeenRaw) {
          return 0;
        }

        const lastSeenAt = new Date(lastSeenRaw);
        if (Number.isNaN(lastSeenAt.getTime())) {
          return 0;
        }

        const friendIds = await this.relationshipService.getMyFriendIds(userId);
        const friendObjectIds = friendIds.map((id) => new Types.ObjectId(id));
        return this.postRepository.countPostsByFriendCreatedAfter(
          friendObjectIds,
          lastSeenAt,
          POST_UNREAD_COUNT_MAX,
        );
      },
      POST_UNREAD_CACHE_TTL_SECONDS,
      {
        validateCached: (value) =>
          !Number.isNaN(value) && Number.isFinite(value) && value >= 0,
        onInvalidCached: () => 0,
        normalizeComputed: (value) =>
          Math.min(Math.max(value, 0), POST_UNREAD_COUNT_MAX),
      },
    );

    return { count };
  }

  async handleUserConnected(userId: string, sessionId: string): Promise<void> {
    await this.postUnreadService.handleUserConnected(userId, sessionId);
  }

  /**
   * Increment unread count (global per user) and session seq (per session).
   * Used when a friend creates a post (WS / debug).
   */
  async incrSessionUnread(
    userId: string,
  ): Promise<{ count: number; seq: number }> {
    return this.postUnreadService.incrementUnreadForUser(userId);
  }

  /**
   * POST /posts/mark-seen — respond 200 immediately, then setImmediate for keys.
   */
  markSeen(userId: string, lastSeenPostCreatedAt: string) {
    void this.postsUnreadQueueService.enqueueMarkSeen(
      userId,
      lastSeenPostCreatedAt,
    );
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
      void this.postsUnreadQueueService.enqueuePostDeleted(
        post.userId.toString(),
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to delete post',
      );
    }
  }

  async getPostsActivity(userId: string): Promise<PostActivityResponse | null> {
    const keySuffix = userId;

    const [activityRow, { count }] = await Promise.all([
      this.cacheService.getOrCompute(
        REDIS_KEY_FEATURES.POST_ACTIVITY_CACHE,
        keySuffix,
        async () => {
          const friendIds =
            await this.relationshipService.getMyFriendIds(userId);
          if (friendIds.length === 0) {
            return null;
          }

          const row = await this.postRepository.findLatestFriendActivities({
            friendIds: friendIds.map((id) => new Types.ObjectId(id)),
          });
          if (!row) {
            return null;
          }

          const imageUrls = this.mediaService.getImageSizesForKey(
            row.mediaKey,
            {
              sizes: [ImageSizeKey.MD],
            },
          );
          const avatarUrls = this.userService.getAvatarUrlsForKey(
            row.avatarKey,
            {
              sizes: [ImageSizeKey.XS],
            },
          );

          return {
            imageUrl: imageUrls.md || imageUrls.original || '',
            caption: row.caption?.trim() ? row.caption : null,
            senderAvatarUrl: avatarUrls.xs || null,
          };
        },
        POST_UNREAD_CACHE_TTL_SECONDS,
      ),
      this.unreadCount(userId),
    ]);

    if (!activityRow) {
      return null;
    }

    return {
      ...activityRow,
      unreadCount: count,
    };
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
