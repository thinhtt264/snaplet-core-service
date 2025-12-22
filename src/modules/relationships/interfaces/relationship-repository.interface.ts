import { Types } from 'mongoose';
import { RelationshipStatus } from '../schemas/relationship.schema';
import { GetRelationshipsResponse } from './relationship-resonse.interface';
import { Relationship } from '../schemas/relationship.schema';

export interface IRelationshipRepository {
  findRelationshipsByStatus(
    userId: Types.ObjectId,
    status: RelationshipStatus,
  ): Promise<GetRelationshipsResponse[]>;
  createRelationship(
    initiatorId: Types.ObjectId,
    targetUserId: Types.ObjectId,
  ): Promise<Relationship>;
  updateRelationshipStatus(
    relationshipId: Types.ObjectId,
    userId: Types.ObjectId,
    status: RelationshipStatus,
  ): Promise<Relationship>;
  deleteRelationship(
    relationshipId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void>;
}
