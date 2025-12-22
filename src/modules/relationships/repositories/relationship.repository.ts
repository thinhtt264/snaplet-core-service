import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Relationship,
  RelationshipStatus,
} from '../schemas/relationship.schema';
import { IRelationshipRepository } from '../interfaces/relationship-repository.interface';
import { GetRelationshipsResponse } from '../interfaces/relationship-resonse.interface';
import { sortUserIds } from '@common/utils/common.utils';

@Injectable()
export class RelationshipRepository implements IRelationshipRepository {
  constructor(
    @InjectModel(Relationship.name)
    private readonly relationshipModel: Model<Relationship>,
  ) {}

  async findRelationshipsByStatus(
    userId: Types.ObjectId,
    status: RelationshipStatus,
  ): Promise<GetRelationshipsResponse[]> {
    const results = await this.relationshipModel
      .aggregate([
        {
          $match: {
            $or: [
              { user1Id: userId, status: status },
              { user2Id: userId, status: status },
            ],
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
            id: { $toString: '$friendId' }, // friendId - ID của người bạn
            username: { $ifNull: ['$friend.username', ''] },
            displayName: { $ifNull: ['$friend.displayName', ''] },
            avatarUrl: { $ifNull: ['$friend.avatarUrl', ''] },
            relationshipId: { $toString: '$_id' }, // ID của relationship
            createdAt: 1,
            status: 1,
          },
        },
        {
          $sort: { createdAt: -1 }, // Sort by khi kết bạn, mới nhất trước
        },
      ])
      .exec();

    return results as GetRelationshipsResponse[];
  }

  async createRelationship(
    initiatorId: Types.ObjectId,
    targetUserId: Types.ObjectId,
  ): Promise<Relationship> {
    const { user1Id, user2Id } = sortUserIds(initiatorId, targetUserId);

    const existingRelationship = await this.relationshipModel.findOne({
      user1Id,
      user2Id,
    });

    if (existingRelationship) {
      throw new ConflictException('Relationship already exists');
    }

    const newRelationship = new this.relationshipModel({
      user1Id,
      user2Id,
      status: RelationshipStatus.PENDING,
      initiator: initiatorId,
    });

    return newRelationship.save();
  }

  async updateRelationshipStatus(
    relationshipId: Types.ObjectId,
    userId: Types.ObjectId,
    status: RelationshipStatus,
  ): Promise<Relationship> {
    const relationship = await this.relationshipModel.findById(relationshipId);

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    // Kiểm tra user có quyền update (phải là user1Id hoặc user2Id)
    const isUser1 = relationship.user1Id.equals(userId);
    const isUser2 = relationship.user2Id.equals(userId);

    if (!isUser1 && !isUser2) {
      throw new ForbiddenException(
        'You do not have permission to update this relationship',
      );
    }

    // Chỉ có thể accept từ pending
    if (status === RelationshipStatus.ACCEPTED) {
      if (relationship.status !== RelationshipStatus.PENDING) {
        throw new ConflictException(
          'Can only accept relationship with pending status',
        );
      }
    }

    relationship.status = status;
    return relationship.save();
  }

  async deleteRelationship(
    relationshipId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    const relationship = await this.relationshipModel.findOneAndDelete({
      _id: relationshipId,
      $or: [{ user1Id: userId }, { user2Id: userId }],
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }
  }
}
