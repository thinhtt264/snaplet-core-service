import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { RelationshipRepository } from '../repositories/relationship.repository';
import { RelationshipStatus } from '../schemas/relationship.schema';
import {
  RelationshipResponse,
  RelationshipWithOtherUserResponse,
} from '../interfaces/relationship-resonse.interface';
import {
  MAX_RELATIONSHIPS_PER_USER,
  RelationshipLimitReason,
} from '@common/constants';
import { throwRelationshipLimitExceeded } from '@common/utils/common.utils';

@Injectable()
export class RelationshipService {
  constructor(
    private readonly relationshipRepository: RelationshipRepository,
  ) {}

  /**
   * Validate relationship limit for both users
   * Business logic validation - checks if users can create/accept more relationships
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @param status - Optional status filter (if not provided, counts all relationships)
   * @throws AppException if either user has reached limit
   */
  private async validateRelationshipLimit(
    userId1: Types.ObjectId,
    userId2: Types.ObjectId,
    status?: RelationshipStatus,
  ): Promise<void> {
    const { user1Count, user2Count } =
      await this.relationshipRepository.countRelationshipsForBothUsers(
        userId1,
        userId2,
        status,
      );

    if (user1Count >= MAX_RELATIONSHIPS_PER_USER) {
      throwRelationshipLimitExceeded(
        RelationshipLimitReason.SOURCE,
        user1Count,
      );
    }

    if (user2Count >= MAX_RELATIONSHIPS_PER_USER) {
      throwRelationshipLimitExceeded(
        RelationshipLimitReason.TARGET,
        user2Count,
      );
    }
  }

  async getRelationshipsByStatus(
    userId: string,
    status: RelationshipStatus,
  ): Promise<RelationshipWithOtherUserResponse[]> {
    try {
      const userObjectId = new Types.ObjectId(userId);

      const relationships =
        await this.relationshipRepository.findRelationshipsByStatus(
          userObjectId,
          status,
        );
      return relationships.map((relationship) => ({
        id: relationship.relationshipId, // ID của relationship document
        userId: relationship.userId, // ID của friend user
        username: relationship.username,
        firstName: relationship.firstName,
        lastName: relationship.lastName,
        avatarUrl: relationship.avatarUrl,
        createdAt: relationship.createdAt,
        status: relationship.status,
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch relationships',
      );
    }
  }

  async create(
    initiatorId: string,
    targetUserId: string,
  ): Promise<RelationshipResponse> {
    // Input validation
    if (initiatorId === targetUserId) {
      throw new ConflictException('Cannot create relationship with yourself');
    }

    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid user id');
    }

    const initiatorObjectId = new Types.ObjectId(initiatorId);
    const targetUserObjectId = new Types.ObjectId(targetUserId);

    // Business validation: Check if relationship already exists
    const existingRelationship =
      await this.relationshipRepository.findExistingRelationship(
        initiatorObjectId,
        targetUserObjectId,
      );

    if (existingRelationship) {
      throw new ConflictException('Relationship already exists');
    }

    // Create relationship (no limit validation for PENDING)
    const relationship = await this.relationshipRepository.createRelationship(
      initiatorObjectId,
      targetUserObjectId,
    );

    return {
      id: relationship._id.toString(),
      user1Id: relationship.user1Id.toString(),
      user2Id: relationship.user2Id.toString(),
      status: relationship.status,
      initiator: relationship.initiator.toString(),
      createdAt: relationship.createdAt,
      updatedAt: relationship.updatedAt,
    };
  }

  async update(
    userId: string,
    relationshipId: string,
    status: RelationshipStatus,
  ): Promise<RelationshipResponse> {
    // Input validation
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(relationshipId)
    ) {
      throw new BadRequestException('Invalid relationship id');
    }

    const userObjectId = new Types.ObjectId(userId);
    const relationshipObjectId = new Types.ObjectId(relationshipId);

    // Fetch relationship once (optimized - reuse for all validations)
    const relationship =
      await this.relationshipRepository.getRelationshipById(
        relationshipObjectId,
      );

    // Business validation: Check if relationship exists
    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    // Business validation: Authorization check
    const isUser1 = relationship.user1Id.equals(userObjectId);
    const isUser2 = relationship.user2Id.equals(userObjectId);

    if (!isUser1 && !isUser2) {
      throw new ForbiddenException(
        'You do not have permission to update this relationship',
      );
    }

    // Business validation: Status transition validation
    if (status === RelationshipStatus.ACCEPTED) {
      if (relationship.status !== RelationshipStatus.PENDING) {
        throw new ConflictException(
          'Can only accept relationship with pending status',
        );
      }

      // Business validation: Check ACCEPTED limit before accepting
      await this.validateRelationshipLimit(
        relationship.user1Id,
        relationship.user2Id,
        RelationshipStatus.ACCEPTED,
      );
    }

    // Update relationship (pure data access)
    const updatedRelationship =
      await this.relationshipRepository.updateRelationshipStatus(
        relationship,
        status,
      );

    return {
      id: updatedRelationship._id.toString(),
      user1Id: updatedRelationship.user1Id.toString(),
      user2Id: updatedRelationship.user2Id.toString(),
      status: updatedRelationship.status,
      initiator: updatedRelationship.initiator.toString(),
      createdAt: updatedRelationship.createdAt,
      updatedAt: updatedRelationship.updatedAt,
    };
  }

  async delete(userId: string, relationshipId: string): Promise<void> {
    // Input validation
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(relationshipId)
    ) {
      throw new BadRequestException('Invalid relationship id');
    }

    const userObjectId = new Types.ObjectId(userId);
    const relationshipObjectId = new Types.ObjectId(relationshipId);

    // Fetch relationship for validation
    const relationship =
      await this.relationshipRepository.getRelationshipById(
        relationshipObjectId,
      );

    // Business validation: Check if relationship exists
    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    // Business validation: Authorization check
    const isUser1 = relationship.user1Id.equals(userObjectId);
    const isUser2 = relationship.user2Id.equals(userObjectId);

    if (!isUser1 && !isUser2) {
      throw new ForbiddenException(
        'You do not have permission to delete this relationship',
      );
    }

    // Delete relationship directly from object (optimized - no duplicate query)
    await this.relationshipRepository.deleteRelationship(relationship);
  }
}
