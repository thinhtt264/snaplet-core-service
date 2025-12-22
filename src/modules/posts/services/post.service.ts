import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PostRepository } from '../repositories/post.repository';
import { GetPostsResponseDto, PostResponseDto } from '../dto/post-response.dto';

@Injectable()
export class PostService {
  constructor(private readonly postRepository: PostRepository) {}

  /**
   * Business logic: Lấy posts feed
   *
   * - includeOwnPosts = false: Chỉ lấy posts của friends
   * - includeOwnPosts = true: Lấy posts của friends + own posts
   *
   * Tận dụng 100% index { userId: 1, createdAt: -1 }
   * Sort theo createdAt DESC (newest first)
   */
  async getPostsFeed(
    userId: string,
    friendIds: string[] = [],
    limit: number = 10,
    offset: number = 0,
  ): Promise<GetPostsResponseDto> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const friendObjectIds = friendIds.map((id) => new Types.ObjectId(id));

      // Build userIds array based on includeOwnPosts flag
      const userIds = [...friendObjectIds, userObjectId];

      // Empty check
      if (userIds.length === 0) {
        return {
          data: [],
          pagination: {
            total: 0,
            offset,
            limit,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      // Query posts với index optimal
      const posts = await this.postRepository.findPostsWithUserInfo(
        userIds,
        limit,
        offset,
      );

      const total = await this.postRepository.countPostsByUserIds(userIds);

      return {
        data: this.transformPosts(posts, userId),
        pagination: {
          total,
          offset,
          limit,
          hasNextPage: offset + limit < total,
          hasPreviousPage: offset > 0,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch posts feed',
      );
    }
  }

  /**
   * Transform raw data to DTO
   */
  private transformPosts(posts: any[], userId: string): PostResponseDto[] {
    return posts.map((post) => ({
      id: post._id.toString(),
      userId: post.userId.toString(),
      username: post.user?.username || '',
      displayName: post.user?.displayName || '',
      avatarUrl: post.user?.avatarUrl || '',
      imageUrl: post.imageUrl,
      caption: post.caption,
      visibility: post.visibility,
      createdAt: post.createdAt,
      isOwnPost: post.userId.toString() === userId,
    }));
  }
}
