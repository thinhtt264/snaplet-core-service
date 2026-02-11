import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
import { StorageService } from '@infrastructure/storage/storage.service';
import { ImageSizeKey } from '@common/types';

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly mediaService: MediaService,
    private readonly relationshipService: RelationshipService,
    private readonly storageService: StorageService,
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

    return {
      id: post._id.toString(),
      createdAt: post.createdAt,
    };
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

    return posts.map((post) => ({
      id: post._id.toString(),
      userId: post.userId.toString(),
      username: post.user.username,
      firstName: post.user.firstName,
      lastName: post.user.lastName,
      avatarUrl: post.user.avatarUrl,
      media: post.media.map((m) => ({
        id: m._id.toString(),
        ownerId: m.ownerId.toString(),
        mimeType: m.mimeType,
        originalUrl: this.storageService.getDefaultImageUrl(m.mediaKey),
        images: this.storageService.getImageUrls(m.mediaKey, postImageSizes),
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
    }));
  }
}
