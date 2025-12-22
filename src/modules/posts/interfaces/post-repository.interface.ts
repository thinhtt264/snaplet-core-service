import { Types } from 'mongoose';

export interface IPostRepository {
  findPostsWithUserInfo(
    userIds: Types.ObjectId[],
    limit: number,
    skip: number,
  ): Promise<any[]>;

  countPostsByUserIds(userIds: Types.ObjectId[]): Promise<number>;
}
