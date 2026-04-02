import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RELATIONSHIP_DELETED_EVENT } from '@modules/relationships/events/relationship-events';
import type { RelationshipDeletedEvent } from '@modules/relationships/events/relationship-events';
import { Types } from 'mongoose';
import { CacheService } from '@modules/cache/cache.service';
import { PostReactionRepository } from '../repositories/post-reaction.repository';

@Injectable()
export class RelationshipEventListener {
  private readonly logger = new Logger(RelationshipEventListener.name);

  constructor(
    private readonly postReactionRepository: PostReactionRepository,
    private readonly cacheService: CacheService,
  ) {}

  @OnEvent(RELATIONSHIP_DELETED_EVENT)
  async handleRelationshipDeleted(
    payload: RelationshipDeletedEvent,
  ): Promise<void> {
    try {
      const impactedPostIds =
        await this.postReactionRepository.deleteReactionsBetweenUsers({
          user1Id: new Types.ObjectId(payload.user1Id),
          user2Id: new Types.ObjectId(payload.user2Id),
        });

      if (impactedPostIds.length > 0) {
        await this.cacheService.invalidateMany(
          REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
          impactedPostIds,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `handleRelationshipDeleted failed: ${error?.message ?? 'unknown error'}`,
      );
    }
  }
}
