import { Types } from 'mongoose';
import { Post } from '../schemas/post.schema';
import { FeedCursor } from '../types/feed-cursor.types';
import { ImageMimeType } from '@common/types/mime-type.types';
import { ImageTransform } from '@common/types';
import { MediaStatus } from '@modules/media/schemas/media.schema';

/**
 * Raw media data from aggregation pipeline
 * Matches the $project stage in post.repository.ts
 */
export interface RawMediaFromAggregation {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  mimeType: ImageMimeType;
  mediaKey?: string;
  duration?: number;
  width: number;
  height: number;
  transform: ImageTransform;
  status: MediaStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw user data from aggregation pipeline
 * Matches the $project stage in post.repository.ts
 */
export interface RawUserFromAggregation {
  username: string;
  firstName: string;
  lastName: string;
  avatarKey: string;
}

/**
 * Raw post data from aggregation pipeline
 * Matches the final $project stage in post.repository.ts
 */
export interface RawPostFromAggregation {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  caption: string;
  visibility: string;
  allowedViewerUserIds?: Types.ObjectId[];
  createdAt: Date;
  user: RawUserFromAggregation;
  media: RawMediaFromAggregation[];
  isOwnerViewedPost: boolean;
}

export interface RawPostActivityFromAggregation {
  caption: string;
  mediaKey?: string;
  avatarKey?: string;
  postId?: Types.ObjectId;
  authorUserId?: Types.ObjectId;
  mediaId?: Types.ObjectId;
}

export interface FindPostsWithCursorParams {
  requesterUserId: Types.ObjectId;
  friendUserIds: Types.ObjectId[];
  /**
   * Optional author filter. Visibility rules are still enforced relative to requester.
   */
  authorUserIds?: Types.ObjectId[];
  limit: number;
  cursor?: FeedCursor | null;
}

export interface FindPostsWithCursorResult {
  posts: RawPostFromAggregation[];
  hasNext: boolean;
  nextCursor: FeedCursor | null;
}

export interface IPostRepository {
  create(post: Partial<Post>): Promise<Post>;
  countPostsByFriendCreatedAfter(
    requesterUserId: Types.ObjectId,
    friendUserIds: Types.ObjectId[],
    createdAtAfter: Date,
    max: number,
  ): Promise<number>;
  findPostsWithCursor(
    params: FindPostsWithCursorParams,
  ): Promise<FindPostsWithCursorResult>;
  findPostByIdWithUserInfo(
    postId: Types.ObjectId,
  ): Promise<RawPostFromAggregation | null>;
  updateOwnerViewedPostAtomic(
    postId: Types.ObjectId,
    ownerUserId: Types.ObjectId,
    nextValue: boolean,
  ): Promise<boolean>;
  findLatestFriendActivities(params: {
    friendIds: Types.ObjectId[];
    requesterUserId: Types.ObjectId;
  }): Promise<RawPostActivityFromAggregation | null>;
}
