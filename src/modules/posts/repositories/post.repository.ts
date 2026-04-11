import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostVisibility } from '../schemas/post.schema';
import {
  IPostRepository,
  FindPostsWithCursorParams,
  FindPostsWithCursorResult,
  RawPostActivityFromAggregation,
} from '../interfaces/post-repository.interface';
import { FeedCursor } from '../types/feed-cursor.types';
import { RawPostFromAggregation } from '../interfaces/post-repository.interface';

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
  ) {}

  private buildMainFeedMatch(params: {
    requesterUserId: Types.ObjectId;
    friendUserIds: Types.ObjectId[];
    extraMatch?: Record<string, any>;
  }): Record<string, any> {
    const { requesterUserId, friendUserIds, extraMatch } = params;
    return {
      isDeleted: { $ne: true },
      $or: [
        { userId: requesterUserId },
        {
          userId: { $in: friendUserIds },
          visibility: PostVisibility.FRIEND_ONLY,
        },
      ],
      ...(extraMatch ?? {}),
    };
  }

  /**
   * Selected-users query is intentionally constrained to friend authors only,
   * so we can keep using the existing `userId + createdAt` compound index and
   * avoid relying on a multikey index on `allowedViewerUserIds`.
   */
  private buildSelectedFeedMatch(params: {
    requesterUserId: Types.ObjectId;
    friendUserIds: Types.ObjectId[];
    extraMatch?: Record<string, any>;
  }): Record<string, any> | null {
    const { requesterUserId, friendUserIds, extraMatch } = params;
    if (friendUserIds.length === 0) {
      return null;
    }

    return {
      isDeleted: { $ne: true },
      userId: { $in: friendUserIds },
      visibility: PostVisibility.SELECTED_USERS,
      allowedViewerUserIds: requesterUserId,
      ...(extraMatch ?? {}),
    };
  }

  private buildCursorCondition(
    cursor?: FeedCursor | null,
  ): Record<string, any> {
    if (!cursor) {
      return {};
    }

    return {
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        {
          createdAt: cursor.createdAt,
          _id: { $lt: cursor._id },
        },
      ],
    };
  }

  private buildLookupStages(): any[] {
    return [
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
            { $sort: { createdAt: 1 } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1, // Keep for isOwnPost check
          caption: 1,
          visibility: 1,
          isOwnerViewedPost: 1,
          createdAt: 1,
          user: 1,
          media: 1,
        },
      },
    ];
  }

  private async fetchFeedTwoQueries(params: {
    requesterUserId: Types.ObjectId;
    friendUserIds: Types.ObjectId[];
    authorUserIds?: Types.ObjectId[];
    limit: number;
    cursor?: FeedCursor | null;
  }): Promise<RawPostFromAggregation[]> {
    const { requesterUserId, friendUserIds, authorUserIds, limit, cursor } =
      params;

    const cursorCondition = this.buildCursorCondition(cursor);
    const withCursor = (match: Record<string, any>) =>
      cursorCondition && Object.keys(cursorCondition).length > 0
        ? { ...match, $and: [...(match.$and ?? []), cursorCondition] }
        : match;

    const mainMatch = withCursor(
      this.buildMainFeedMatch({
        requesterUserId,
        friendUserIds,
        extraMatch: authorUserIds?.length
          ? { userId: { $in: authorUserIds } }
          : undefined,
      }),
    );

    const selectedBase = this.buildSelectedFeedMatch({
      requesterUserId,
      friendUserIds,
      extraMatch: authorUserIds?.length
        ? { userId: { $in: authorUserIds } }
        : undefined,
    });
    const selectedMatch = selectedBase ? withCursor(selectedBase) : null;

    const lookupStages = this.buildLookupStages();

    const runQuery = (match: Record<string, any>) =>
      this.postModel
        .aggregate<RawPostFromAggregation>([
          { $match: match },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: limit + 1 },
          ...lookupStages,
        ])
        .exec();

    const [mainRows, selectedRows] = await Promise.all([
      runQuery(mainMatch),
      selectedMatch ? runQuery(selectedMatch) : Promise.resolve([]),
    ]);

    const merged = [...mainRows, ...selectedRows].sort((a, b) => {
      const diff = b.createdAt.getTime() - a.createdAt.getTime();
      if (diff !== 0) return diff;
      return b._id.toString() > a._id.toString() ? 1 : -1;
    });

    const seen = new Set<string>();
    return merged
      .filter((p) => {
        const key = p._id.toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit + 1);
  }

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

  async updateOwnerViewedPostAtomic(
    postId: Types.ObjectId,
    ownerUserId: Types.ObjectId,
    nextValue: boolean,
  ): Promise<boolean> {
    const result = await this.postModel
      .updateOne(
        {
          _id: postId,
          userId: ownerUserId,
          isDeleted: { $ne: true },
          isOwnerViewedPost: !nextValue,
        },
        {
          $set: { isOwnerViewedPost: nextValue },
        },
      )
      .exec();

    return (result.modifiedCount ?? 0) > 0;
  }

  async countPostsByFriendCreatedAfter(
    requesterUserId: Types.ObjectId,
    friendUserIds: Types.ObjectId[],
    createdAtAfter: Date,
    max: number,
  ): Promise<number> {
    if (friendUserIds.length === 0 || max < 1) return 0;
    const limit = max + 1;
    const result = await this.postModel
      .aggregate<{ n: number }>([
        {
          $match: {
            isDeleted: { $ne: true },
            createdAt: { $gt: createdAtAfter },
            $or: [
              // Friend-only posts from friends
              {
                userId: { $in: friendUserIds },
                visibility: PostVisibility.FRIEND_ONLY,
              },
              // Selected-users posts where requester is included
              {
                visibility: PostVisibility.SELECTED_USERS,
                allowedViewerUserIds: requesterUserId,
              },
            ],
          },
        },
        { $limit: limit },
        { $count: 'n' },
      ])
      .exec();
    const n = result[0]?.n ?? 0;
    return Math.min(n, max);
  }

  async findPostsWithCursor(
    params: FindPostsWithCursorParams,
  ): Promise<FindPostsWithCursorResult> {
    const { requesterUserId, friendUserIds, authorUserIds, limit, cursor } =
      params;

    const results = await this.fetchFeedTwoQueries({
      requesterUserId,
      friendUserIds,
      authorUserIds,
      limit,
      cursor,
    });

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

  async findNewer(params: {
    friendIds: Types.ObjectId[];
    requesterUserId: Types.ObjectId;
    since: Date;
    limit: number;
  }): Promise<RawPostFromAggregation[]> {
    const { friendIds, requesterUserId, since, limit } = params;

    if (friendIds.length === 0 || limit < 1) return [];

    return this.postModel
      .aggregate<RawPostFromAggregation>([
        {
          $match: {
            isDeleted: { $ne: true },
            createdAt: { $gt: since }, // strictly greater than (avoid returning top item client already has)
            $or: [
              {
                userId: { $in: friendIds },
                visibility: PostVisibility.FRIEND_ONLY,
              },
              {
                visibility: PostVisibility.SELECTED_USERS,
                allowedViewerUserIds: requesterUserId,
              },
            ],
          },
        },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: limit },
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
      ])
      .exec();
  }

  async findLatestFriendActivities(params: {
    friendIds: Types.ObjectId[];
    requesterUserId: Types.ObjectId;
  }): Promise<RawPostActivityFromAggregation | null> {
    const { friendIds, requesterUserId } = params;
    if (friendIds.length === 0) {
      return null;
    }

    const rows = await this.postModel
      .aggregate<RawPostActivityFromAggregation>([
        {
          $match: {
            isDeleted: { $ne: true },
            $or: [
              {
                userId: { $in: friendIds },
                visibility: PostVisibility.FRIEND_ONLY,
              },
              {
                visibility: PostVisibility.SELECTED_USERS,
                allowedViewerUserIds: requesterUserId,
              },
            ],
          },
        },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: 1 },
        { $addFields: { mediaId: { $arrayElemAt: ['$mediaIds', 0] } } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [{ $project: { _id: 0, avatarKey: 1 } }],
          },
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'media',
            localField: 'mediaId',
            foreignField: '_id',
            as: 'media',
            pipeline: [
              {
                $match: {
                  isDeleted: { $ne: true },
                  status: 'READY',
                },
              },
              { $project: { _id: 0, mediaKey: 1 } },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            caption: 1,
            avatarKey: '$user.avatarKey',
            mediaKey: { $arrayElemAt: ['$media.mediaKey', 0] },
            postId: '$_id',
            authorUserId: '$userId',
            mediaId: { $arrayElemAt: ['$mediaIds', 0] },
          },
        },
      ])
      .exec();

    return rows[0] ?? null;
  }

  // (buildFeedPipeline removed in favor of two-query pattern)

  /**
   * Find single post by ID with user info and media
   * Uses same pipeline structure as findPostsWithCursor for consistency
   */
  async findPostByIdWithUserInfo(
    postId: Types.ObjectId,
  ): Promise<RawPostFromAggregation | null> {
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
          isOwnerViewedPost: 1,
          createdAt: 1,
          user: 1,
          media: 1,
        },
      },
    ];

    const results = await this.postModel
      .aggregate<RawPostFromAggregation>(pipeline as any[])
      .exec();
    return results.length > 0 ? results[0] : null;
  }
}
