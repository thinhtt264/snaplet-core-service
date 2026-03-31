import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FindReactionActorsParams,
  FindReactionActorsResult,
  ReactionActorRow,
} from '../interfaces/post-reaction-repository.interface';
import { PostReaction } from '../schemas/post-reaction.schema';
import { MAX_REACTION_HISTORY } from '../constants/post-reaction.constants';

@Injectable()
export class PostReactionRepository {
  constructor(
    @InjectModel(PostReaction.name)
    private readonly postReactionModel: Model<PostReaction>,
  ) {}

  async upsertReaction(params: {
    postId: Types.ObjectId;
    reactorUserId: Types.ObjectId;
    postOwnerUserId: Types.ObjectId;
    incomingReactionIcon: string;
  }): Promise<PostReaction> {
    const { postId, reactorUserId, postOwnerUserId, incomingReactionIcon } =
      params;
    return this.postReactionModel
      .findOneAndUpdate(
        {
          postId,
          reactorUserId,
          isDeleted: { $ne: true },
        },
        [
          {
            $set: {
              createdAt: {
                $ifNull: ['$createdAt', '$$NOW'],
              },
              updatedAt: '$$NOW',
              postOwnerUserId,
              isDeleted: false,
              reactionIcon: {
                $let: {
                  vars: {
                    incomingToken: incomingReactionIcon,
                    previousTokens: {
                      $filter: {
                        input: {
                          $map: {
                            input: {
                              $split: [{ $ifNull: ['$reactionIcon', ''] }, ','],
                            },
                            as: 'token',
                            in: { $trim: { input: '$$token' } },
                          },
                        },
                        as: 'token',
                        cond: { $ne: ['$$token', ''] },
                      },
                    },
                  },
                  in: {
                    $let: {
                      vars: {
                        nextTokens: {
                          $slice: [
                            {
                              $concatArrays: [
                                ['$$incomingToken'],
                                {
                                  $filter: {
                                    input: '$$previousTokens',
                                    as: 'token',
                                    cond: {
                                      $ne: ['$$token', '$$incomingToken'],
                                    },
                                  },
                                },
                              ],
                            },
                            MAX_REACTION_HISTORY,
                          ],
                        },
                      },
                      in: {
                        $reduce: {
                          input: '$$nextTokens',
                          initialValue: '',
                          in: {
                            $cond: [
                              { $eq: ['$$value', ''] },
                              '$$this',
                              { $concat: ['$$value', ',', '$$this'] },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          updatePipeline: true,
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

  async deleteReactionsByPostId(postId: Types.ObjectId): Promise<void> {
    await this.postReactionModel
      .deleteMany({
        postId,
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
