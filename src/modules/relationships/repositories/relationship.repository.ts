import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Relationship,
  RelationshipStatus,
} from '../schemas/relationship.schema';
import {
  IRelationshipRepository,
  RelationshipAggregateResult,
} from '../interfaces/relationship-repository.interface';
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
  ): Promise<RelationshipAggregateResult[]> {
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
            _id: 0, // Exclude _id field (redundant with relationshipId)
            userId: { $toString: '$friendId' }, // ID của người bạn
            username: { $ifNull: ['$friend.username', ''] },
            firstName: { $ifNull: ['$friend.firstName', ''] },
            lastName: { $ifNull: ['$friend.lastName', ''] },
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

    return results;
  }

  /**
   * Count relationships for a user by status
   * Pure query method - no business logic validation
   * @param userId - User ID to count
   * @param status - Optional status filter (if not provided, counts all statuses)
   * @returns Count of relationships
   */
  async countRelationshipsByStatus(
    userId: Types.ObjectId,
    status?: RelationshipStatus,
  ): Promise<number> {
    const query: any = {
      $or: [{ user1Id: userId }, { user2Id: userId }],
    };

    if (status) {
      query.status = status;
    }

    return this.relationshipModel.countDocuments(query);
  }

  /**
   * Count relationships for multiple users in a single query (optimized)
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @param status - Optional status filter (if not provided, counts all statuses)
   * @returns Object with counts for both users
   */
  async countRelationshipsForBothUsers(
    userId1: Types.ObjectId,
    userId2: Types.ObjectId,
    status?: RelationshipStatus,
  ): Promise<{ user1Count: number; user2Count: number }> {
    // Build match conditions for each user
    const user1Match: any = {
      $or: [{ user1Id: userId1 }, { user2Id: userId1 }],
    };
    const user2Match: any = {
      $or: [{ user1Id: userId2 }, { user2Id: userId2 }],
    };

    // Add status filter if provided
    if (status) {
      user1Match.status = status;
      user2Match.status = status;
    }

    const result = await this.relationshipModel
      .aggregate([
        {
          $facet: {
            user1Count: [{ $match: user1Match }, { $count: 'count' }],
            user2Count: [{ $match: user2Match }, { $count: 'count' }],
          },
        },
      ])
      .exec();

    return {
      user1Count: result[0]?.user1Count[0]?.count || 0,
      user2Count: result[0]?.user2Count[0]?.count || 0,
    };
  }

  /**
   * Find existing relationship between two users
   * Pure query method - no validation
   * @param user1Id - First user ID
   * @param user2Id - Second user ID
   * @returns Relationship document or null if not found
   */
  async findExistingRelationship(
    user1Id: Types.ObjectId,
    user2Id: Types.ObjectId,
  ): Promise<Relationship | null> {
    const { user1Id: sortedUser1Id, user2Id: sortedUser2Id } = sortUserIds(
      user1Id,
      user2Id,
    );
    return this.relationshipModel
      .findOne({
        user1Id: sortedUser1Id,
        user2Id: sortedUser2Id,
      })
      .exec();
  }

  /**
   * Create a new relationship
   * Pure data access - no validation
   * @param initiatorId - User who initiates the relationship
   * @param targetUserId - User who receives the relationship request
   * @returns Created relationship document
   */
  async createRelationship(
    initiatorId: Types.ObjectId,
    targetUserId: Types.ObjectId,
  ): Promise<Relationship> {
    const { user1Id, user2Id } = sortUserIds(initiatorId, targetUserId);

    const newRelationship = new this.relationshipModel({
      user1Id,
      user2Id,
      status: RelationshipStatus.PENDING,
      initiator: initiatorId,
    });

    return newRelationship.save();
  }

  /**
   * Get relationship by ID
   * Pure query method - no validation
   * @param relationshipId - Relationship ID
   * @returns Relationship document or null if not found
   */
  async getRelationshipById(
    relationshipId: Types.ObjectId,
  ): Promise<Relationship | null> {
    return this.relationshipModel.findById(relationshipId).exec();
  }

  /**
   * Update relationship status
   * Pure data access - no validation
   * @param relationship - Relationship document to update
   * @param status - New status
   * @returns Updated relationship document
   */
  async updateRelationshipStatus(
    relationship: Relationship,
    status: RelationshipStatus,
  ): Promise<Relationship> {
    relationship.status = status;
    return relationship.save();
  }

  /**
   * Delete relationship by ID
   * Pure data access - no validation
   * @param relationshipId - Relationship ID to delete
   * @returns Deleted relationship document or null if not found
   */
  async deleteRelationshipById(
    relationshipId: Types.ObjectId,
  ): Promise<Relationship | null> {
    return this.relationshipModel.findByIdAndDelete(relationshipId).exec();
  }

  /**
   * Delete relationship directly from relationship object
   * Optimized - no need to query database again
   * @param relationship - Relationship document to delete
   * @returns Promise that resolves when deleted
   */
  async deleteRelationship(relationship: Relationship): Promise<void> {
    await relationship.deleteOne();
  }
}
