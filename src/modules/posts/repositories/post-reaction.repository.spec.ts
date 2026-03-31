import { Types } from 'mongoose';
import { PostReactionRepository } from './post-reaction.repository';

describe('PostReactionRepository', () => {
  it('sets updatedAt explicitly in pipeline upsert', async () => {
    const exec = jest.fn().mockResolvedValue({});
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    const model = {
      findOneAndUpdate,
    };

    const repository = new PostReactionRepository(model as any);

    await repository.upsertReaction({
      postId: new Types.ObjectId(),
      reactorUserId: new Types.ObjectId(),
      postOwnerUserId: new Types.ObjectId(),
      incomingReactionIcon: '🎉',
    });

    const updatePipeline = findOneAndUpdate.mock.calls[0][1];
    expect(Array.isArray(updatePipeline)).toBe(true);
    expect(updatePipeline[0].$set.updatedAt).toBe('$$NOW');
    expect(updatePipeline[0].$set.createdAt).toEqual({
      $ifNull: ['$createdAt', '$$NOW'],
    });
  });
});
