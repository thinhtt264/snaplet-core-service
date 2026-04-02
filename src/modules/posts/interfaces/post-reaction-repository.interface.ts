import { Types } from 'mongoose';

export interface ReactionActorRow {
  userId: Types.ObjectId;
  username: string;
  firstName: string;
  lastName: string;
  avatarKey?: string;
  reactionIcon: string;
  reactedAt: Date;
  _id: Types.ObjectId;
}

export interface FindReactionActorsParams {
  postId: Types.ObjectId;
}

export interface FindReactionActorsResult {
  items: ReactionActorRow[];
}
