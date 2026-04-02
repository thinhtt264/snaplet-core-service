import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';

jest.mock('@modules/media/services/media.service', () => ({
  MediaService: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PostService } = require('./post.service');

describe('PostService post reactions - reactToPost', () => {
  it('uses atomic upsert without pre-reading active reaction', async () => {
    const postId = '507f1f77bcf86cd799439011';
    const postOwnerUserId = '507f1f77bcf86cd799439013';
    const reactorUserId = '507f1f77bcf86cd799439012';

    const postRepository = {
      findPostById: jest.fn().mockResolvedValue({
        userId: new Types.ObjectId(postOwnerUserId),
      }),
    };

    const postReactionRepository = {
      findActiveReaction: jest.fn(),
      upsertReaction: jest.fn().mockResolvedValue({
        postId: new Types.ObjectId(postId),
        reactorUserId: new Types.ObjectId(reactorUserId),
        reactionIcon: '🎉,😀,👍',
        updatedAt: new Date('2026-03-31T10:00:00.000Z'),
      }),
    };

    const relationshipService = {
      getMyFriendIds: jest.fn().mockResolvedValue([postOwnerUserId]),
    };

    const cacheService = {
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateByTag: jest.fn().mockResolvedValue(undefined),
    };

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const service = new PostService(
      postRepository as any,
      postReactionRepository as any,
      {} as any,
      relationshipService as any,
      {} as any,
      cacheService as any,
      {} as any,
      {} as any,
      eventEmitter,
    );

    const result = await service.reactToPost(reactorUserId, postId, '  🎉  ');

    expect(postReactionRepository.findActiveReaction).not.toHaveBeenCalled();
    expect(postReactionRepository.upsertReaction).toHaveBeenCalledTimes(1);
    expect(postReactionRepository.upsertReaction).toHaveBeenCalledWith({
      postId: expect.any(Types.ObjectId),
      reactorUserId: expect.any(Types.ObjectId),
      postOwnerUserId: expect.any(Types.ObjectId),
      incomingReactionIcon: '🎉',
    });

    expect(cacheService.invalidate).toHaveBeenCalledWith(
      REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
      postId,
    );

    expect(result.reactionIcon).toBe('🎉,😀,👍');
  });

  it('rejects repeated emoji string like 🎉🎉🎉🎉', async () => {
    const postId = '507f1f77bcf86cd799439011';
    const postOwnerUserId = '507f1f77bcf86cd799439013';
    const reactorUserId = '507f1f77bcf86cd799439012';

    const postRepository = {
      findPostById: jest.fn().mockResolvedValue({
        userId: new Types.ObjectId(postOwnerUserId),
      }),
    };

    const postReactionRepository = {
      upsertReaction: jest.fn(),
    };

    const relationshipService = {
      getMyFriendIds: jest.fn().mockResolvedValue([postOwnerUserId]),
    };

    const cacheService = {
      invalidate: jest.fn(),
    };

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const service = new PostService(
      postRepository as any,
      postReactionRepository as any,
      {} as any,
      relationshipService as any,
      {} as any,
      cacheService as any,
      {} as any,
      {} as any,
      eventEmitter,
    );

    await expect(
      service.reactToPost(reactorUserId, postId, '🎉🎉🎉🎉🎉🎉🎉🎉'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postReactionRepository.upsertReaction).not.toHaveBeenCalled();
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });

  it('accepts single-grapheme country flag emoji', async () => {
    const postId = '507f1f77bcf86cd799439011';
    const postOwnerUserId = '507f1f77bcf86cd799439013';
    const reactorUserId = '507f1f77bcf86cd799439012';

    const postRepository = {
      findPostById: jest.fn().mockResolvedValue({
        userId: new Types.ObjectId(postOwnerUserId),
      }),
    };

    const postReactionRepository = {
      upsertReaction: jest.fn().mockResolvedValue({
        postId: new Types.ObjectId(postId),
        reactorUserId: new Types.ObjectId(reactorUserId),
        reactionIcon: '🇺🇸',
        updatedAt: new Date('2026-03-31T10:00:00.000Z'),
      }),
    };

    const relationshipService = {
      getMyFriendIds: jest.fn().mockResolvedValue([postOwnerUserId]),
    };

    const cacheService = {
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateByTag: jest.fn().mockResolvedValue(undefined),
    };

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const service = new PostService(
      postRepository as any,
      postReactionRepository as any,
      {} as any,
      relationshipService as any,
      {} as any,
      cacheService as any,
      {} as any,
      {} as any,
      eventEmitter,
    );

    const result = await service.reactToPost(reactorUserId, postId, '🇺🇸');

    expect(postReactionRepository.upsertReaction).toHaveBeenCalledWith({
      postId: expect.any(Types.ObjectId),
      reactorUserId: expect.any(Types.ObjectId),
      postOwnerUserId: expect.any(Types.ObjectId),
      incomingReactionIcon: '🇺🇸',
    });
    expect(result.reactionIcon).toBe('🇺🇸');
  });

  it('accepts single-grapheme keycap emoji', async () => {
    const postId = '507f1f77bcf86cd799439011';
    const postOwnerUserId = '507f1f77bcf86cd799439013';
    const reactorUserId = '507f1f77bcf86cd799439012';

    const postRepository = {
      findPostById: jest.fn().mockResolvedValue({
        userId: new Types.ObjectId(postOwnerUserId),
      }),
    };

    const postReactionRepository = {
      upsertReaction: jest.fn().mockResolvedValue({
        postId: new Types.ObjectId(postId),
        reactorUserId: new Types.ObjectId(reactorUserId),
        reactionIcon: '1️⃣',
        updatedAt: new Date('2026-03-31T10:00:00.000Z'),
      }),
    };

    const relationshipService = {
      getMyFriendIds: jest.fn().mockResolvedValue([postOwnerUserId]),
    };

    const cacheService = {
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateByTag: jest.fn().mockResolvedValue(undefined),
    };

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const service = new PostService(
      postRepository as any,
      postReactionRepository as any,
      {} as any,
      relationshipService as any,
      {} as any,
      cacheService as any,
      {} as any,
      {} as any,
      eventEmitter,
    );

    const result = await service.reactToPost(reactorUserId, postId, '1️⃣');

    expect(postReactionRepository.upsertReaction).toHaveBeenCalledWith({
      postId: expect.any(Types.ObjectId),
      reactorUserId: expect.any(Types.ObjectId),
      postOwnerUserId: expect.any(Types.ObjectId),
      incomingReactionIcon: '1️⃣',
    });
    expect(result.reactionIcon).toBe('1️⃣');
  });
});

describe('PostService - deletePost', () => {
  it('deletes associated reactions and invalidates reactions cache', async () => {
    const postId = '507f1f77bcf86cd799439011';
    const postOwnerUserId = '507f1f77bcf86cd799439013';
    const postIdObjectId = new Types.ObjectId(postId);

    const postRepository = {
      findPostById: jest.fn().mockResolvedValue({
        userId: new Types.ObjectId(postOwnerUserId),
      }),
      hardDeletePost: jest.fn().mockResolvedValue(undefined),
    };

    const postReactionRepository = {
      deleteReactionsByPostId: jest.fn().mockResolvedValue(undefined),
    };

    const cacheService = {
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateByTag: jest.fn().mockResolvedValue(undefined),
    };

    const postsUnreadQueueService = {
      enqueuePostDeleted: jest.fn().mockResolvedValue(undefined),
    };

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const service = new PostService(
      postRepository as any,
      postReactionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      cacheService as any,
      {} as any,
      postsUnreadQueueService as any,
      eventEmitter,
    );

    await service.deletePost(postOwnerUserId, postId);

    expect(postRepository.findPostById).toHaveBeenCalledWith(postIdObjectId);
    expect(postReactionRepository.deleteReactionsByPostId).toHaveBeenCalledWith(
      postIdObjectId,
    );
    expect(postRepository.hardDeletePost).toHaveBeenCalledWith(postIdObjectId);
    expect(cacheService.invalidate).toHaveBeenCalledWith(
      REDIS_KEY_FEATURES.POST_REACTIONS_CACHE,
      postId,
    );
    expect(cacheService.invalidateByTag).toHaveBeenCalledWith(`post:${postId}`);
    expect(postsUnreadQueueService.enqueuePostDeleted).toHaveBeenCalledWith(
      postOwnerUserId,
    );
  });
});
