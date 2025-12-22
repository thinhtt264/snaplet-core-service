import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { RelationshipRepository } from '../repositories/relationship.repository';
import { GetRelationshipsResponse } from '../interfaces/relationship-resonse.interface';
import {
  Relationship,
  RelationshipStatus,
} from '../schemas/relationship.schema';

@Injectable()
export class RelationshipService {
  constructor(
    private readonly relationshipRepository: RelationshipRepository,
  ) {}

  async getRelationshipsByStatus(
    userId: string,
    status: RelationshipStatus,
  ): Promise<GetRelationshipsResponse[]> {
    try {
      const userObjectId = new Types.ObjectId(userId);

      return this.relationshipRepository.findRelationshipsByStatus(
        userObjectId,
        status,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch relationships',
      );
    }
  }

  async create(
    initiatorId: string,
    targetUserId: string,
  ): Promise<Relationship> {
    if (initiatorId === targetUserId) {
      throw new ConflictException('Cannot create relationship with yourself');
    }

    if (
      !Types.ObjectId.isValid(initiatorId) ||
      !Types.ObjectId.isValid(targetUserId)
    ) {
      throw new BadRequestException('Invalid user id');
    }

    const initiatorObjectId = new Types.ObjectId(initiatorId);
    const targetUserObjectId = new Types.ObjectId(targetUserId);

    return await this.relationshipRepository.createRelationship(
      initiatorObjectId,
      targetUserObjectId,
    );
  }

  async update(
    userId: string,
    relationshipId: string,
    status: RelationshipStatus,
  ): Promise<Relationship> {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(relationshipId)
    ) {
      throw new BadRequestException('Invalid relationship id');
    }

    const userObjectId = new Types.ObjectId(userId);
    const relationshipObjectId = new Types.ObjectId(relationshipId);

    return this.relationshipRepository.updateRelationshipStatus(
      relationshipObjectId,
      userObjectId,
      status,
    );
  }

  async delete(userId: string, relationshipId: string): Promise<void> {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(relationshipId)
    ) {
      throw new BadRequestException('Invalid relationship id');
    }

    const userObjectId = new Types.ObjectId(userId);
    const relationshipObjectId = new Types.ObjectId(relationshipId);

    return this.relationshipRepository.deleteRelationship(
      relationshipObjectId,
      userObjectId,
    );
  }
}
