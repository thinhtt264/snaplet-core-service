import { UserBasicInfoResponse } from '@modules/users/interfaces/user-response.interface';

export interface PostReactionResponse {
  postId: string;
  reactorUserId: string;
  reactionIcon: string;
  updatedAt: Date;
}

export interface ReactionActorResponse extends UserBasicInfoResponse {
  reactionIcon: string;
  reactedAt: Date;
}

export type GetPostReactionsResponse = ReactionActorResponse[];
