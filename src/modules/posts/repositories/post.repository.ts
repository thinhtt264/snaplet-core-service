import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post } from '../schemas/post.schema';
import { IPostRepository } from '../interfaces/post-repository.interface';

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
  ) {}

  /**
   * Sử dụng aggregation pipeline để tối ưu query
   * Join với users collection để lấy thông tin user
   * Tận dụng index: userId, createdAt
   */
  async findPostsWithUserInfo(
    userIds: Types.ObjectId[],
    limit: number,
    skip: number,
  ): Promise<any[]> {
    const pipeline: any[] = [
      {
        $match: {
          userId: { $in: userIds },
          isDeleted: { $ne: true },
        },
      },
      {
        $sort: { createdAt: -1 },
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
                displayName: 1,
                avatarUrl: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          imageUrl: 1,
          caption: 1,
          visibility: 1,
          createdAt: 1,
          'user.username': 1,
          'user.displayName': 1,
          'user.avatarUrl': 1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ];

    return this.postModel.aggregate(pipeline).exec();
  }
}
