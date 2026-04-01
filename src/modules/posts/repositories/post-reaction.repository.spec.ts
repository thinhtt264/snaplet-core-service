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

  it('deletes all reactions by post id', async () => {
    const exec = jest.fn().mockResolvedValue({});
    const deleteMany = jest.fn().mockReturnValue({ exec });
    const model = {
      deleteMany,
    };

    const repository = new PostReactionRepository(model as any);
    const postId = new Types.ObjectId();

    await repository.deleteReactionsByPostId(postId);

    expect(deleteMany).toHaveBeenCalledWith({ postId });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('deletes reactions between two users and returns impacted post ids', async () => {
    const exec = jest.fn().mockResolvedValue({});
    const deleteMany = jest.fn().mockReturnValue({ exec });
    const distinct = jest
      .fn()
      .mockResolvedValue([new Types.ObjectId('507f1f77bcf86cd799439011')]);
    const model = {
      deleteMany,
      distinct,
    };

    const repository = new PostReactionRepository(model as any);
    const user1Id = new Types.ObjectId('507f1f77bcf86cd799439012');
    const user2Id = new Types.ObjectId('507f1f77bcf86cd799439013');

    const postIds = await repository.deleteReactionsBetweenUsers({
      user1Id,
      user2Id,
    });

    expect(distinct).toHaveBeenCalledWith('postId', {
      $or: [
        {
          postOwnerUserId: user1Id,
          reactorUserId: user2Id,
        },
        {
          postOwnerUserId: user2Id,
          reactorUserId: user1Id,
        },
      ],
    });
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(postIds).toEqual(['507f1f77bcf86cd799439011']);
  });
});
