import {
  Injectable,
  HttpException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { RelationshipRepository } from '../repositories/relationship.repository';
import { RelationshipStatus } from '../schemas/relationship.schema';
import {
  RelationshipCountResponse,
  RelationshipResponse,
  RelationshipWithOtherUserResponse,
} from '../interfaces/relationship-resonse.interface';
import {
  MAX_RELATIONSHIPS_PER_USER,
  RelationshipLimitReason,
} from '@common/constants';
import { throwRelationshipLimitExceeded } from '@common/utils/common.utils';
import { UserService } from '@modules/users/services/user.service';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SocketService } from '@modules/socket/socket.service';
import { FRIEND_REQUEST_RECEIVED_EVENT } from '@modules/socket/events/socket-events';
import {
  RELATIONSHIP_DELETED_EVENT,
  RelationshipDeletedEvent,
} from '../events/relationship-events';
@Injectable()
export class RelationshipService {
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly relationshipRepository: RelationshipRepository,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly socketService: SocketService,
  ) {
    this.cacheTtlSeconds = this.configService.get<number>(
      'relationships.cache.ttlSeconds',
      3600, // default: 1 hour
    );
  }

  /**
   * Build cache key suffix for relationships by status
   * Format: userId:status
   */
  private buildRelationshipCacheKeySuffix(
    userId: string,
    status: RelationshipStatus,
  ): string {
    return `${userId}:${status}`;
  }

  /**
   * Build cache key suffix for my friend IDs
   * Format: userId
   */
  private buildMyFriendIdsCacheKeySuffix(userId: string): string {
    return userId;
  }

  /**
   * Cache suffix for incoming pending request count (recipient-only), under RELATIONSHIPS feature.
   * Distinct from list cache key `${userId}:${pending}` used by getRelationshipsWithProfilesByStatus.
   */
  private buildPendingIncomingCountCacheKeySuffix(userId: string): string {
    return `${userId}:${RelationshipStatus.PENDING}:incoming`;
  }

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

  async getRelationshipsWithProfilesByStatus(
    userId: string,
    status: RelationshipStatus,
  ): Promise<RelationshipWithOtherUserResponse[]> {
    const keySuffix = this.buildRelationshipCacheKeySuffix(userId, status);

    return this.cacheService.getOrCompute(
      REDIS_KEY_FEATURES.RELATIONSHIPS,
      keySuffix,
      async () => {
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
            avatarUrls: this.userService.getAvatarUrlsForKey(
              relationship.avatarKey,
            ),
            createdAt: relationship.createdAt,
            status: relationship.status,
          }));
        } catch (error) {
          throw new InternalServerErrorException(
            error.message || 'Failed to fetch relationships',
          );
        }
      },
      this.cacheTtlSeconds,
    );
  }

  async getRelationshipsWithProfilesByStatuses(
    userId: string,
    statuses: RelationshipStatus[],
  ): Promise<RelationshipWithOtherUserResponse[]> {
    const uniqueStatuses = [...new Set(statuses)];
    if (uniqueStatuses.length === 1) {
      return this.getRelationshipsWithProfilesByStatus(
        userId,
        uniqueStatuses[0],
      );
    }
    const results = await Promise.all(
      uniqueStatuses.map((status) =>
        this.getRelationshipsWithProfilesByStatus(userId, status),
      ),
    );
    const merged = results.flat();
    merged.sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );
    return merged;
  }

  async getMyFriendIds(userId: string): Promise<string[]> {
    const keySuffix = this.buildMyFriendIdsCacheKeySuffix(userId);

    return this.cacheService.getOrCompute(
      REDIS_KEY_FEATURES.MY_FRIEND_IDS,
      keySuffix,
      async () => {
        const userObjectId = new Types.ObjectId(userId);
        const friendIds =
          await this.relationshipRepository.findMyFriendIds(userObjectId);
        return friendIds.map((id) => id.toString());
      },
      this.cacheTtlSeconds,
    );
  }

  /**
   * Accepted friend count (reuses MY_FRIEND_IDS cache) and pending requests
   * **awaiting this user’s accept** only (excludes pending where this user is initiator).
   */
  async getRelationshipCount(
    userId: string,
  ): Promise<RelationshipCountResponse> {
    const [friendIds, pendingRequestCount] = await Promise.all([
      this.getMyFriendIds(userId),
      this.cacheService.getOrCompute(
        REDIS_KEY_FEATURES.RELATIONSHIPS,
        this.buildPendingIncomingCountCacheKeySuffix(userId),
        async () => {
          const userObjectId = new Types.ObjectId(userId);
          return this.relationshipRepository.countPendingAwaitingUserAccept(
            userObjectId,
          );
        },
        this.cacheTtlSeconds,
      ),
    ]);

    return {
      acceptedFriendCount: friendIds.length,
      pendingRequestCount,
    };
  }

  /**
   * Get relationship between current user and target user.
   * @param currentUserId - Current user ID (from JWT)
   * @param targetUserId - Target user ID to check relationship with
   * @returns Relationship if exists, null otherwise
   */
  async getRelationshipWithUser(
    currentUserId: string,
    targetUserId: string,
  ): Promise<RelationshipResponse | null> {
    if (
      !Types.ObjectId.isValid(currentUserId) ||
      !Types.ObjectId.isValid(targetUserId)
    ) {
      throw new BadRequestException('Invalid user id');
    }

    const currentUserObjectId = new Types.ObjectId(currentUserId);
    const targetUserObjectId = new Types.ObjectId(targetUserId);

    const relationship =
      await this.relationshipRepository.findExistingRelationship(
        currentUserObjectId,
        targetUserObjectId,
      );

    if (!relationship) {
      return null;
    }

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

  private async invalidateRelationshipsCache(userId: string): Promise<void> {
    const relationshipSuffixes = [
      ...Object.values(RelationshipStatus).map((status) =>
        this.buildRelationshipCacheKeySuffix(userId, status),
      ),
      this.buildPendingIncomingCountCacheKeySuffix(userId),
    ];

    await this.cacheService.invalidateMany(
      REDIS_KEY_FEATURES.RELATIONSHIPS,
      relationshipSuffixes,
    );

    await this.cacheService.invalidate(
      REDIS_KEY_FEATURES.MY_FRIEND_IDS,
      userId,
    );
  }

  /** Relationship / friend-id Redis caches for this user (logout and similar). */
  async invalidateCachesForUser(userId: string): Promise<void> {
    await this.invalidateRelationshipsCache(userId);
  }

  async create(
    initiatorId: string,
    targetUserId: string,
  ): Promise<RelationshipResponse> {
    try {
      if (initiatorId === targetUserId) {
        throw new ConflictException('Cannot create relationship with yourself');
      }

      const userExists = await this.userService.checkUserExists(targetUserId);
      if (!userExists) {
        throw new BadRequestException('User id not found');
      }

      const initiatorObjectId = new Types.ObjectId(initiatorId);
      const targetUserObjectId = new Types.ObjectId(targetUserId);

      const relationship = await this.relationshipRepository.createRelationship(
        initiatorObjectId,
        targetUserObjectId,
      );

      await this.invalidateRelationshipsCache(relationship.user1Id.toString());
      await this.invalidateRelationshipsCache(relationship.user2Id.toString());

      this.socketService.emitToUser(
        targetUserId,
        FRIEND_REQUEST_RECEIVED_EVENT,
        null,
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
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const mongoCode = (error as { code?: number })?.code;
      if (mongoCode === 11000) {
        throw new ConflictException('Relationship already exists');
      }

      throw new InternalServerErrorException('Failed to create relationship');
    }
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
      // Recipient (user B) = the user who is not the initiator
      const recipientId = relationship.initiator.equals(relationship.user1Id)
        ? relationship.user2Id
        : relationship.user1Id;

      if (!recipientId.equals(userObjectId)) {
        throw new ForbiddenException(
          'Only the recipient can accept a relationship request',
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

    await this.invalidateRelationshipsCache(
      updatedRelationship.user1Id.toString(),
    );
    await this.invalidateRelationshipsCache(
      updatedRelationship.user2Id.toString(),
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

    await this.invalidateRelationshipsCache(relationship.user1Id.toString());
    await this.invalidateRelationshipsCache(relationship.user2Id.toString());

    // Delete relationship directly from object (optimized - no duplicate query)
    await this.relationshipRepository.deleteRelationship(relationship);

    this.eventEmitter.emit(RELATIONSHIP_DELETED_EVENT, {
      user1Id: relationship.user1Id.toString(),
      user2Id: relationship.user2Id.toString(),
    } as RelationshipDeletedEvent);
  }
}
