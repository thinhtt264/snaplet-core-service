import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FindReactionActorsParams,
  FindReactionActorsResult,
  ReactionActorRow,
} from '../interfaces/post-reaction-repository.interface';
import { PostReaction } from '../schemas/post-reaction.schema';

@Injectable()
export class PostReactionRepository {
  constructor(
    @InjectModel(PostReaction.name)
    private readonly postReactionModel: Model<PostReaction>,
  ) {}

  async findActiveReaction(params: {
    postId: Types.ObjectId;
    reactorUserId: Types.ObjectId;
  }): Promise<Pick<PostReaction, 'reactionIcon'> | null> {
    return this.postReactionModel
      .findOne({
        postId: params.postId,
        reactorUserId: params.reactorUserId,
        isDeleted: { $ne: true },
      })
      .select({ reactionIcon: 1 })
      .lean<Pick<PostReaction, 'reactionIcon'>>()
      .exec();
  }

  async upsertReaction(params: {
    postId: Types.ObjectId;
    reactorUserId: Types.ObjectId;
    postOwnerUserId: Types.ObjectId;
    reactionIcon: string;
  }): Promise<PostReaction> {
    const { postId, reactorUserId, postOwnerUserId, reactionIcon } = params;
    return this.postReactionModel
      .findOneAndUpdate(
        {
          postId,
          reactorUserId,
          isDeleted: { $ne: true },
        },
        {
          $set: {
            postOwnerUserId,
            reactionIcon,
            isDeleted: false,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();
  }

  async removeReaction(params: {
    postId: Types.ObjectId;
    reactorUserId: Types.ObjectId;
  }): Promise<void> {
    await this.postReactionModel
      .deleteOne({
        postId: params.postId,
        reactorUserId: params.reactorUserId,
      })
      .exec();
  }

  async findReactionActors(
    params: FindReactionActorsParams,
  ): Promise<FindReactionActorsResult> {
    const { postId } = params;
    const pipeline: any[] = [
      {
        $match: {
          postId,
          isDeleted: { $ne: true },
        },
      },
    ];

    pipeline.push(
      { $sort: { updatedAt: -1, _id: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'reactorUserId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                username: 1,
                firstName: 1,
                lastName: 1,
                avatarKey: 1,
              },
            },
          ],
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          userId: '$reactorUserId',
          username: '$user.username',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          avatarKey: '$user.avatarKey',
          reactionIcon: '$reactionIcon',
          reactedAt: '$updatedAt',
        },
      },
    );

    const rows = await this.postReactionModel
      .aggregate<ReactionActorRow>(pipeline)
      .exec();

    return {
      items: rows.map((item) => ({
        ...item,
      })),
    };
  }
}
