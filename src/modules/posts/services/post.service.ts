import {
  BadRequestException,
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
import { PostReactionRepository } from '../repositories/post-reaction.repository';
import { getCurrentReactionIcon } from '../utils/current-reaction-icon.util';
import { MediaService } from '@modules/media/services/media.service';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { UserService } from '@modules/users/services/user.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { ImageSizeKey } from '@common/types';
import { POST_CREATED_EVENT, PostCreatedEvent } from '../events/post-events';
import {
  DEFAULT_CACHE_POST_TTL,
  POST_UNREAD_COUNT_MAX,
} from '../constants/post-unread.constants';
import { PostUnreadService } from './post-unread.service';
import { PostsUnreadQueueService } from '../queue/posts-unread.queue.service';
import { GetNewerFeedDto } from '../dto/get-newer-feed.dto';
import { CacheService } from '@modules/cache/cache.service';
import { RedisService } from '@common/redis/redis.service';
import { buildRedisKey } from '@common/utils';
import { throwPostCreateLimitExceeded } from '@common/utils';
import {
  GetPostReactionsResponse,
  PostReactionResponse,
} from '../interfaces/post-reaction-response.interface';
import {
  REACTION_CREATED_FOR_NOTIFICATION_EVENT,
  type ReactionCreatedNotificationPayload,
} from '@modules/notifications/events/notification.events';
import {
  POST_CREATE_DAILY_LIMIT,
  POST_CREATE_LIMIT_TTL_SECONDS,
} from '@common/constants';

@Injectable()
export class PostService {
  private static readonly EMOJI_SEGMENTER = new Intl.Segmenter('en', {
    granularity: 'grapheme',
  });

  constructor(
    private readonly postRepository: PostRepository,
    private readonly postReactionRepository: PostReactionRepository,
    private readonly mediaService: MediaService,
    private readonly relationshipService: RelationshipService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly redisService: RedisService,
    private readonly postUnreadService: PostUnreadService,
    private readonly postsUnreadQueueService: PostsUnreadQueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getPostsFeed(
    userId: string,
    limit: number = 10,
    cursor?: string,
    filterUserIds?: string[],
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

      // Optional filter: when requester passes `userIds`, only include posts
      // from those authors that are within the allowed visibility scope:
      // self or accepted friends.
      let effectiveUserIds = userIds;
      if (filterUserIds?.length) {
        const uniqueFilterUserIds = Array.from(new Set(filterUserIds));
        for (const uid of uniqueFilterUserIds) {
          if (!Types.ObjectId.isValid(uid)) {
            throw new BadRequestException('Invalid user id');
          }
        }

        const allowedUserIdStrings = new Set(
          userIds.map((id) => id.toString()),
        );
        const filterObjectIds = uniqueFilterUserIds.map(
          (uid) => new Types.ObjectId(uid),
        );

        effectiveUserIds = filterObjectIds.filter((id) =>
          allowedUserIdStrings.has(id.toString()),
        );
      }

      if (effectiveUserIds.length === 0) {
        return {
          data: [],
          pagination: { limit, nextCursor: null },
        };
      }

      const parsedCursor = parseCursor(cursor);
      const result = await this.postRepository.findPostsWithCursor({
        userIds: effectiveUserIds,
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
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error?.message || 'Failed to fetch posts feed',
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

  async getPostById(userId: string, postId: string): Promise<PostResponse> {
    try {
      const post = await this.postRepository.findPostByIdWithUserInfo(
        new Types.ObjectId(postId),
      );
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const ownerUserId = post.userId.toString();
      const isOwnPost = ownerUserId === userId;

      if (!isOwnPost && post.visibility === PostVisibility.FRIEND_ONLY) {
        const friendIds = await this.relationshipService.getMyFriendIds(userId);
        if (!friendIds.includes(ownerUserId)) {
          throw new ForbiddenException(
            'You do not have permission to view this post',
          );
        }
      }

      const transformed = this.transformPosts([post], userId)[0];
      if (!transformed) {
        throw new NotFoundException('Post not found');
      }

      return transformed;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error?.message || 'Failed to fetch post',
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
    const quotaRedisKey = await this.assertCanCreatePost(userId);

    try {
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
    } catch (error) {
      if (quotaRedisKey) {
        await this.releaseCreatePostQuota(quotaRedisKey);
      }

      throw error;
    }
  }

  private async assertCanCreatePost(userId: string): Promise<string | null> {
    // Soft dependency: when Redis is unavailable, do not block post creation.
    if (!this.redisService.isRedisAvailable()) {
      return null;
    }

    const redisKey = buildRedisKey(
      REDIS_KEY_FEATURES.POST_CREATE_DAILY_LIMIT,
      userId,
    );
    const currentCount = await this.redisService.incr(redisKey);

    if (currentCount === 1) {
      await this.redisService.expire(redisKey, POST_CREATE_LIMIT_TTL_SECONDS);
    }

    if (currentCount > POST_CREATE_DAILY_LIMIT) {
      const ttl = await this.redisService.ttl(redisKey);
      const hoursRemaining = ttl > 0 ? Math.ceil(ttl / 3600) : 24;
      throwPostCreateLimitExceeded(
        POST_CREATE_DAILY_LIMIT,
        currentCount,
        hoursRemaining,
      );
    }

    return redisKey;
  }

  private async releaseCreatePostQuota(redisKey: string): Promise<void> {
    // Best-effort rollback for failed create paths after quota reservation.
    if (!this.redisService.isRedisAvailable()) {
      return;
    }

    const nextCount = await this.redisService.decr(redisKey);
    if (nextCount <= 0) {
      await this.redisService.del(redisKey);
    }
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
      DEFAULT_CACHE_POST_TTL,
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

  async ownerViewedPost(ownerUserId: string, postId: string): Promise<void> {
    try {
      const postIdObjectId = new Types.ObjectId(postId);
      const ownerUserObjectId = new Types.ObjectId(ownerUserId);

      await this.postRepository.updateOwnerViewedPostAtomic(
        postIdObjectId,
        ownerUserObjectId,
        true,
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error?.message || 'Failed to clear owner viewed state',
      );
    }
  }

  private async markOwnerUnviewedPost(
    postIdObjectId: Types.ObjectId,
    ownerUserId: string,
  ): Promise<void> {
    await this.postRepository.updateOwnerViewedPostAtomic(
      postIdObjectId,
      new Types.ObjectId(ownerUserId),
      false,
    );
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    try {
      const postIdObjectId = new Types.ObjectId(postId);
      const post = await this.postRepository.findPostById(postIdObjectId);
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      if (post.userId.toString() !== userId) {
        throw new ForbiddenException('You are not the owner of this post');
      }

      await this.postReactionRepository.deleteReactionsByPostId(postIdObjectId);
      await this.cacheService.invalidate(
        REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
        postId,
      );
      await this.cacheService.invalidateByTag(`post:${postId}`);
      await this.postRepository.hardDeletePost(postIdObjectId);
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

  async reactToPost(
    userId: string,
    postId: string,
    reactionIcon: string,
  ): Promise<PostReactionResponse> {
    try {
      const { postIdObjectId, ownerUserId } =
        await this.assertPostExists(postId);
      await this.assertCanReactToPost(userId, ownerUserId);
      const reactorUserObjectId = new Types.ObjectId(userId);
      const sanitizedReactionIcon = reactionIcon.trim();
      if (
        !sanitizedReactionIcon ||
        sanitizedReactionIcon.includes(',') ||
        !this.isSingleEmojiToken(sanitizedReactionIcon)
      ) {
        throw new BadRequestException(
          'Reaction icon must be a single emoji token without comma',
        );
      }

      const reaction = await this.postReactionRepository.upsertReaction({
        postId: postIdObjectId,
        reactorUserId: reactorUserObjectId,
        postOwnerUserId: new Types.ObjectId(ownerUserId),
        incomingReactionIcon: sanitizedReactionIcon,
      });

      await this.markOwnerUnviewedPost(postIdObjectId, ownerUserId);

      // Invalidate cached actor list for this post so owner sees updates quickly.
      await this.cacheService.invalidate(
        REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
        postId,
      );

      setImmediate(async () => {
        try {
          const [reactorDisplayName, actorAvatarUrl] = await Promise.all([
            this.userService.getReactionNotificationLabel(userId),
            this.userService.getReactionNotificationAvatarUrl(userId),
          ]);
          const notificationPayload: ReactionCreatedNotificationPayload = {
            postId,
            postOwnerId: ownerUserId,
            reactorId: userId,
            reactorDisplayName,
            actorAvatarUrl,
            reactionIcon: getCurrentReactionIcon(reaction.reactionIcon),
          };
          this.eventEmitter.emit(
            REACTION_CREATED_FOR_NOTIFICATION_EVENT,
            notificationPayload,
          );
        } catch {
          // Preserve previous behavior: do not fail request due to async notification work.
        }
      });

      return {
        postId: reaction.postId.toString(),
        reactorUserId: reaction.reactorUserId.toString(),
        reactionIcon: reaction.reactionIcon,
        updatedAt: reaction.updatedAt,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to react to post',
      );
    }
  }

  async removePostReaction(userId: string, postId: string): Promise<void> {
    try {
      const { postIdObjectId, ownerUserId } =
        await this.assertPostExists(postId);
      await this.assertCanRemovePostReaction(userId, ownerUserId);

      await this.postReactionRepository.removeReaction({
        postId: postIdObjectId,
        reactorUserId: new Types.ObjectId(userId),
      });

      // Invalidate cached actor list for this post so owner sees updates quickly.
      await this.cacheService.invalidate(
        REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
        postId,
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to remove post reaction',
      );
    }
  }

  async getPostReactions(
    userId: string,
    postId: string,
  ): Promise<GetPostReactionsResponse> {
    try {
      const { postIdObjectId, ownerUserId } =
        await this.assertPostExists(postId);
      this.assertCanViewReactionActors(userId, ownerUserId);

      return await this.cacheService.getOrCompute<GetPostReactionsResponse>(
        REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
        postId,
        async () => {
          const result = await this.postReactionRepository.findReactionActors({
            postId: postIdObjectId,
          });

          return result.items.map((item) => ({
            userId: item.userId.toString(),
            username: item.username,
            firstName: item.firstName,
            lastName: item.lastName,
            avatarUrls: this.userService.getAvatarUrlsForKey(item.avatarKey, {
              sizes: [ImageSizeKey.XS],
            }),
            reactionIcon: item.reactionIcon,
            reactedAt: item.reactedAt,
          }));
        },
        DEFAULT_CACHE_POST_TTL,
        {
          deserialize: (raw) => {
            const parsed = JSON.parse(raw) as Array<
              Omit<GetPostReactionsResponse[number], 'reactedAt'> & {
                reactedAt: string;
              }
            >;

            return parsed.map((item) => ({
              ...item,
              reactedAt: new Date(item.reactedAt),
            }));
          },
          resolveTags: (items) => [
            `post:${postId}`,
            ...items.map((i) => `user:${i.userId}`),
          ],
        },
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to get post reactions',
      );
    }
  }

  async getPostsActivity(userId: string): Promise<PostActivityResponse | null> {
    const keySuffix = userId;

    type ActivityCached = Omit<PostActivityResponse, 'unreadCount'> & {
      _cacheTagRefs: {
        postId: string;
        authorUserId: string;
        mediaId: string;
      };
    };

    const [activityRow, { count }] = await Promise.all([
      this.cacheService.getOrCompute<ActivityCached | null>(
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
          if (!row || !row.postId || !row.authorUserId || !row.mediaId) {
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
            postId: row.postId.toString(),
            imageUrl: imageUrls.md || imageUrls.original || '',
            caption: row.caption?.trim() ? row.caption : null,
            senderAvatarUrl: avatarUrls.xs || null,
            _cacheTagRefs: {
              postId: row.postId.toString(),
              authorUserId: row.authorUserId.toString(),
              mediaId: row.mediaId.toString(),
            },
          };
        },
        DEFAULT_CACHE_POST_TTL,
        {
          resolveTags: (v) => {
            if (!v?._cacheTagRefs) {
              return [];
            }
            const { postId, authorUserId, mediaId } = v._cacheTagRefs;
            return [
              `post:${postId}`,
              `user:${authorUserId}`,
              `media:${mediaId}`,
              `activity:${userId}`,
            ];
          },
        },
      ),
      this.unreadCount(userId),
    ]);

    if (!activityRow) {
      return null;
    }

    const { _cacheTagRefs, ...activityRest } = activityRow;
    void _cacheTagRefs;

    return {
      ...activityRest,
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
        isOwnerViewedPost: post.isOwnerViewedPost ?? false,
      };
    });
  }

  private async assertPostExists(postId: string): Promise<{
    postIdObjectId: Types.ObjectId;
    ownerUserId: string;
  }> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post id');
    }

    const postIdObjectId = new Types.ObjectId(postId);
    const post = await this.postRepository.findPostById(postIdObjectId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return {
      postIdObjectId,
      ownerUserId: post.userId.toString(),
    };
  }

  private async assertCanReactToPost(
    reactorUserId: string,
    postOwnerUserId: string,
  ): Promise<void> {
    if (reactorUserId === postOwnerUserId) {
      throw new ForbiddenException('Post owner cannot react to own post');
    }

    const friendIds =
      await this.relationshipService.getMyFriendIds(reactorUserId);
    if (!friendIds.includes(postOwnerUserId)) {
      throw new ForbiddenException('Only friends can react to this post');
    }
  }

  private async assertCanRemovePostReaction(
    reactorUserId: string,
    postOwnerUserId: string,
  ): Promise<void> {
    if (reactorUserId === postOwnerUserId) {
      throw new ForbiddenException('Post owner cannot remove own reaction');
    }
  }

  private assertCanViewReactionActors(
    requesterUserId: string,
    postOwnerUserId: string,
  ): void {
    if (requesterUserId !== postOwnerUserId) {
      throw new ForbiddenException(
        'Only post owner can view detailed reaction actors',
      );
    }
  }

  private isSingleEmojiToken(value: string): boolean {
    const graphemes = [...PostService.EMOJI_SEGMENTER.segment(value)];
    if (graphemes.length !== 1) {
      return false;
    }

    // Keycap emoji are single graphemes composed from base + VS16? + U+20E3.
    if (/^[0-9#*]\uFE0F?\u20E3$/u.test(value)) {
      return true;
    }

    // Accept single-grapheme emoji tokens, including flag sequences made of
    // Regional Indicator symbols (which are not Extended_Pictographic).
    return /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(value);
  }
}
