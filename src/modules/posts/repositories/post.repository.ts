import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post } from '../schemas/post.schema';
import {
  IPostRepository,
  FindPostsWithCursorParams,
  FindPostsWithCursorResult,
} from '../interfaces/post-repository.interface';
import { FeedCursor } from '../types/feed-cursor.types';

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
  ) {}

  async create(post: Partial<Post>): Promise<Post> {
    const createdPost = new this.postModel(post);
    return createdPost.save();
  }

  async hardDeletePost(postId: Types.ObjectId): Promise<void> {
    await this.postModel.deleteOne({ _id: postId }).exec();
  }

  async findPostById(postId: Types.ObjectId): Promise<Post | null> {
    return this.postModel.findById(postId).exec();
  }
  /**
   * Cursor-based pagination with optimized pipeline
   * Uses compound cursor (createdAt, _id) for stable pagination
   * Join với users collection để lấy thông tin user
   * Tận dụng index: userId, createdAt, _id
   */
  async findPostsWithCursor(
    params: FindPostsWithCursorParams,
  ): Promise<FindPostsWithCursorResult> {
    const { userIds, limit, cursor } = params;

    const pipeline = this.buildFeedPipeline({ userIds, limit, cursor });

    const results = await this.postModel.aggregate(pipeline as any[]).exec();

    // Check if there's a next page (we fetched limit + 1)
    const hasNext = results.length > limit;
    const posts = hasNext ? results.slice(0, limit) : results;

    // Generate next cursor from last post
    let nextCursor: FeedCursor | null = null;
    if (hasNext && posts.length > 0) {
      const lastPost = posts[posts.length - 1];
      nextCursor = {
        createdAt: lastPost.createdAt,
        _id: lastPost._id,
      };
    }

    return {
      posts,
      hasNext,
      nextCursor,
    };
  }

  /**
   * Build optimized feed pipeline for cursor-based pagination
   * Performance optimizations:
   * 1. $match + cursor filter first (uses index)
   * 2. $sort uses compound index (createdAt: -1, _id: -1)
   * 3. $limit before $lookup (reduces join operations)
   * 4. Filter media early (status: READY, isDeleted)
   */
  private buildFeedPipeline(params: {
    userIds: Types.ObjectId[];
    limit: number;
    cursor?: FeedCursor | null;
  }) {
    const { userIds, limit, cursor } = params;

    const matchStage: any = {
      userId: { $in: userIds },
      isDeleted: { $ne: true },
    };

    // Cursor condition (AFTER cursor position)
    // Uses compound comparison: createdAt < cursor.createdAt OR
    // (createdAt = cursor.createdAt AND _id < cursor._id)
    if (cursor) {
      matchStage.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        {
          createdAt: cursor.createdAt,
          _id: { $lt: cursor._id },
        },
      ];
    }

    return [
      // 1️⃣ FILTER + CURSOR (uses index: idx_userId_createdAt_id_active)
      { $match: matchStage },

      // 2️⃣ SORT STABLE (uses index: idx_createdAt_id_active)
      // Compound sort ensures stable pagination even with duplicate createdAt
      { $sort: { createdAt: -1, _id: -1 } },

      // 3️⃣ FETCH EXTRA 1 ITEM (detect hasNext)
      // Limit BEFORE lookup to reduce join operations
      { $limit: limit + 1 },

      // 4️⃣ JOIN USER (only for limited documents)
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                username: 1,
                firstName: 1,
                lastName: 1,
                avatarKey: 1,
              },
            },
          ],
        },
      },
      { $unwind: '$user' },

      // 5️⃣ JOIN MEDIA (only for limited documents)
      // Filter early: only READY media, not deleted
      {
        $lookup: {
          from: 'media',
          localField: 'mediaIds',
          foreignField: '_id',
          as: 'media',
          pipeline: [
            {
              $match: {
                isDeleted: { $ne: true },
                status: 'READY',
              },
            },
            {
              $project: {
                _id: 1,
                ownerId: 1,
                mimeType: 1,
                mediaKey: 1,
                duration: 1,
                transform: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
            // Sort media by creation order (optional)
            { $sort: { createdAt: 1 } },
          ],
        },
      },

      // 6️⃣ SHAPE RESPONSE (only needed fields)
      {
        $project: {
          _id: 1,
          userId: 1, // Keep for isOwnPost check
          caption: 1,
          visibility: 1,
          createdAt: 1,
          user: 1,
          media: 1,
        },
      },
    ];
  }

  /**
   * Find single post by ID with user info and media
   * Uses same pipeline structure as findPostsWithCursor for consistency
   */
  async findPostByIdWithUserInfo(postId: Types.ObjectId): Promise<any | null> {
    const pipeline = [
      {
        $match: {
          _id: postId,
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                username: 1,
                firstName: 1,
                lastName: 1,
                avatarKey: 1,
              },
            },
          ],
        },
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'media',
          localField: 'mediaIds',
          foreignField: '_id',
          as: 'media',
          pipeline: [
            {
              $match: {
                isDeleted: { $ne: true },
                status: 'READY',
              },
            },
            {
              $project: {
                _id: 1,
                mimeType: 1,
                mediaKey: 1,
                duration: 1,
                transform: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
            { $sort: { createdAt: 1 } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          caption: 1,
          visibility: 1,
          createdAt: 1,
          user: 1,
          media: 1,
        },
      },
    ];

    const results = await this.postModel.aggregate(pipeline as any[]).exec();
    return results.length > 0 ? results[0] : null;
  }
}
