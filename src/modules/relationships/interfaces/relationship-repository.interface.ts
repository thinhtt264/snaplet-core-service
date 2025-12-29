import { Types } from 'mongoose';
import { RelationshipStatus } from '../schemas/relationship.schema';
import { Relationship } from '../schemas/relationship.schema';

/**
 * Raw aggregate result from findRelationshipsByStatus query
 * Reflects exact structure returned from MongoDB aggregation pipeline
 */
export interface RelationshipAggregateResult {
  userId: string; // Friend user ID (as string)
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  relationshipId: string; // Relationship document ID (as string)
  createdAt: Date;
  status: RelationshipStatus;
}

export interface IRelationshipRepository {
  /**
   * Find relationships by status with other user details
   * @param userId - Current user's ID
   * @param status - Relationship status to filter
   * @returns List of aggregate results containing relationship and friend user info
   */
  findRelationshipsByStatus(
    userId: Types.ObjectId,
    status: RelationshipStatus,
  ): Promise<RelationshipAggregateResult[]>;

  /**
   * Find existing relationship between two users
   * @param user1Id - First user ID
   * @param user2Id - Second user ID
   * @returns Relationship document or null if not found
   */
  findExistingRelationship(
    user1Id: Types.ObjectId,
    user2Id: Types.ObjectId,
  ): Promise<Relationship | null>;

  /**
   * Get relationship by ID
   * @param relationshipId - Relationship ID
   * @returns Relationship document or null if not found
   */
  getRelationshipById(
    relationshipId: Types.ObjectId,
  ): Promise<Relationship | null>;

  /**
   * Count relationships for a user by status
   * @param userId - User ID to count
   * @param status - Optional status filter
   * @returns Count of relationships
   */
  countRelationshipsByStatus(
    userId: Types.ObjectId,
    status?: RelationshipStatus,
  ): Promise<number>;

  /**
   * Count relationships for multiple users in a single query
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @param status - Optional status filter
   * @returns Object with counts for both users
   */
  countRelationshipsForBothUsers(
    userId1: Types.ObjectId,
    userId2: Types.ObjectId,
    status?: RelationshipStatus,
  ): Promise<{ user1Count: number; user2Count: number }>;

  /**
   * Create a new relationship
   * @param initiatorId - User who initiates the relationship
   * @param targetUserId - User who receives the relationship request
   * @returns Created relationship document
   */
  createRelationship(
    initiatorId: Types.ObjectId,
    targetUserId: Types.ObjectId,
  ): Promise<Relationship>;

  /**
   * Update relationship status
   * @param relationship - Relationship document to update
   * @param status - New status
   * @returns Updated relationship document
   */
  updateRelationshipStatus(
    relationship: Relationship,
    status: RelationshipStatus,
  ): Promise<Relationship>;

  /**
   * Delete relationship by ID
   * @param relationshipId - Relationship ID to delete
   * @returns Deleted relationship document or null if not found
   */
  deleteRelationshipById(
    relationshipId: Types.ObjectId,
  ): Promise<Relationship | null>;

  /**
   * Delete relationship directly from relationship object
   * Optimized - no need to query database again
   * @param relationship - Relationship document to delete
   */
  deleteRelationship(relationship: Relationship): Promise<void>;
}
