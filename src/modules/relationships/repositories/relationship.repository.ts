import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Relationship,
  RelationshipStatus,
} from '../schemas/relationship.schema';
import { IRelationshipRepository } from '../interfaces/relationship-repository.interface';

@Injectable()
export class RelationshipRepository implements IRelationshipRepository {
  constructor(
    @InjectModel(Relationship.name)
    private readonly relationshipModel: Model<Relationship>,
  ) {}

  /**
   * Query tối ưu với compound index: { user1Id: 1, status: 1 } và { user2Id: 1, status: 1 }
   * Trả về danh sách friendIds (không bao gồm userId của chính user)
   */
  async findAcceptedFriendIds(
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const relationships = await this.relationshipModel
      .find(
        {
          $or: [{ user1Id: userId }, { user2Id: userId }],
          status: RelationshipStatus.ACCEPTED,
        },
        { user1Id: 1, user2Id: 1 }, // Chỉ select fields cần thiết
      )
      .lean() // Tăng performance bằng cách trả về plain JS object
      .exec();

    // Extract friend IDs (loại bỏ userId của chính user)
    return relationships.map((rel) => {
      return rel.user1Id.toString() === userId.toString()
        ? rel.user2Id
        : rel.user1Id;
    });
  }

  /**
   * Lấy danh sách friends với thông tin user
   * Join với users collection để lấy username, displayName, avatarUrl
   * Tận dụng compound index và aggregation pipeline
   */
  async findAcceptedFriendsWithUserInfo(
    userId: Types.ObjectId,
  ): Promise<any[]> {
    return this.relationshipModel
      .aggregate([
        {
          $match: {
            $or: [{ user1Id: userId }, { user2Id: userId }],
            status: RelationshipStatus.ACCEPTED,
          },
        },
        {
          // Xác định friendId (user còn lại không phải userId)
          $addFields: {
            friendId: {
              $cond: {
                if: { $eq: ['$user1Id', userId] },
                then: '$user2Id',
                else: '$user1Id',
              },
            },
          },
        },
        {
          // Join với users collection
          $lookup: {
            from: 'users',
            localField: 'friendId',
            foreignField: '_id',
            as: 'friend',
          },
        },
        {
          $unwind: {
            path: '$friend',
            preserveNullAndEmptyArrays: false, // Bỏ qua nếu user không tồn tại
          },
        },
        {
          $project: {
            _id: 1,
            friendId: 1,
            createdAt: 1,
            'friend.username': 1,
            'friend.displayName': 1,
            'friend.avatarUrl': 1,
          },
        },
        {
          $sort: { createdAt: -1 }, // Sort by khi kết bạn, mới nhất trước
        },
      ])
      .exec();
  }
}
