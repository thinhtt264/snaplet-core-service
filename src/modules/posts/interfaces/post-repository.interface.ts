import { Types } from 'mongoose';
import { Post } from '../schemas/post.schema';
import { FeedCursor } from '../types/feed-cursor.types';

export interface FindPostsWithCursorParams {
  userIds: Types.ObjectId[];
  limit: number;
  cursor?: FeedCursor | null;
}

export interface FindPostsWithCursorResult {
  posts: any[];
  hasNext: boolean;
  nextCursor: FeedCursor | null;
}

export interface IPostRepository {
  create(post: Partial<Post>): Promise<Post>;
  findPostsWithCursor(
    params: FindPostsWithCursorParams,
  ): Promise<FindPostsWithCursorResult>;
  findPostByIdWithUserInfo(postId: Types.ObjectId): Promise<any | null>;
}
