import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { RelationshipEventListener } from './relationship-event.listener';

describe('RelationshipEventListener', () => {
  it('removes cross-user reactions and invalidates related post caches', async () => {
    const postReactionRepository = {
      deleteReactionsBetweenUsers: jest
        .fn()
        .mockResolvedValue(['507f1f77bcf86cd799439011']),
    };
    const cacheService = {
      invalidateMany: jest.fn().mockResolvedValue(undefined),
    };

    const listener = new RelationshipEventListener(
      postReactionRepository as any,
      cacheService as any,
    );

    await listener.handleRelationshipDeleted({
      user1Id: '507f1f77bcf86cd799439012',
      user2Id: '507f1f77bcf86cd799439013',
    });

    expect(postReactionRepository.deleteReactionsBetweenUsers).toHaveBeenCalledTimes(
      1,
    );
    expect(cacheService.invalidateMany).toHaveBeenCalledWith(
      REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
      ['507f1f77bcf86cd799439011'],
    );
  });
});
