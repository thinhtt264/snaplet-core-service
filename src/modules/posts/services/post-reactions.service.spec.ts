import { Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';

// This test only validates authorization logic in `removePostReaction`.
// `PostService` imports `MediaService`, which in turn imports a Mongoose schema
// with an incompatible decorator typing for Jest runtime. Mock it to avoid
// loading the full media module graph.
jest.mock('@modules/media/services/media.service', () => ({
  MediaService: jest.fn(),
}));

// Import after mocking to ensure Jest uses the mocks above.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PostService } = require('./post.service');

describe('PostService post reactions - removePostReaction', () => {
  it('allows removing a reaction even if caller is no longer friends', async () => {
    const postId = '507f1f77bcf86cd799439011';
    const postOwnerUserId = '507f1f77bcf86cd799439013';
    const reactorUserId = '507f1f77bcf86cd799439012';

    const postRepository = {
      findPostById: jest.fn().mockResolvedValue({
        userId: new Types.ObjectId(postOwnerUserId),
      }),
    };

    const postReactionRepository = {
      removeReaction: jest.fn().mockResolvedValue(undefined),
    };

    const relationshipService = {
      getMyFriendIds: jest.fn().mockResolvedValue([]),
    };

    const cacheService = {
      invalidate: jest.fn().mockResolvedValue(undefined),
    };

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const service = new PostService(
      postRepository as any,
      postReactionRepository as any,
      {} as any, // mediaService
      relationshipService as any,
      {} as any, // userService
      cacheService as any,
      {} as any, // postUnreadService
      {} as any, // postsUnreadQueueService
      eventEmitter,
    );

    await service.removePostReaction(reactorUserId, postId);

    // Un-friending after reacting must not block deletion.
    expect(relationshipService.getMyFriendIds).not.toHaveBeenCalled();

    expect(postReactionRepository.removeReaction).toHaveBeenCalledTimes(1);
    const removeCallArg =
      postReactionRepository.removeReaction.mock.calls[0][0];
    expect(removeCallArg.postId.toString()).toBe(postId);
    expect(removeCallArg.reactorUserId.toString()).toBe(reactorUserId);

    expect(cacheService.invalidate).toHaveBeenCalledWith(
      REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
      postId,
    );
  });
});
