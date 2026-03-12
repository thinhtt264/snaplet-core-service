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
import { ImageSizeKey } from '@common/types';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { POST_SSE_EVENTS } from '@common/constants/event-names.constants';
import { RedisService } from '@common/redis/redis.service';

@Injectable()
export class PostService {
  private static readonly UNREAD_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

  constructor(
    private readonly postRepository: PostRepository,
    private readonly mediaService: MediaService,
    private readonly relationshipService: RelationshipService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
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

      const transformed = this.transformPosts(result.posts, userId);

      // Chỉ chạy khi fetch trang đầu (không có cursorParam)
      if (!cursor && result.posts.length > 0) {
        const newest = result.posts[0];

        setImmediate(async () => {
          await Promise.all([
            this.cacheService.set(
              REDIS_KEY_FEATURES.POSTS_CACHE_LAST_SEEN_CURSOR,
              userId,
              {
                createdAt: newest.createdAt.toISOString(),
                id: newest._id.toString(),
              },
              PostService.UNREAD_TTL_SECONDS,
            ),
            this.cacheService.invalidate(
              REDIS_KEY_FEATURES.POSTS_CACHE_UNREAD,
              userId,
            ),
          ]);
        });
      }

      return {
        data: transformed,
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

    this.eventEmitter.emit(POST_SSE_EVENTS.POST_CREATED, {
      postId: post._id.toString(),
      authorId: userId,
    });

    return {
      id: post._id.toString(),
      createdAt: post.createdAt,
    };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.cacheService.getOrCompute<number>(
      REDIS_KEY_FEATURES.POSTS_CACHE_UNREAD,
      userId,
      async () => {
        // 2. Check cursor
        const cursor = await this.cacheService.get<{
          createdAt: string;
          id: string;
        }>(REDIS_KEY_FEATURES.POSTS_CACHE_LAST_SEEN_CURSOR, userId);

        if (!cursor) {
          return 0;
        }

        const friendIds = await this.relationshipService.getMyFriendIds(userId);
        if (!friendIds.length) {
          return 0;
        }

        const count = await this.postRepository.countUnreadPostsAfterCursor({
          friendIds,
          cursorCreatedAt: new Date(cursor.createdAt),
          cursorId: new Types.ObjectId(cursor.id),
        });

        return count;
      },
      PostService.UNREAD_TTL_SECONDS,
    );

    return { count };
  }

  markPostsSeen(userId: string): void {
    // Only reset unread counter, keep seq as-is
    this.redisService.del(
      `${REDIS_KEY_FEATURES.POSTS_SESSION_UNREAD}:${userId}`,
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
