import { UserBasicInfoResponse } from '@modules/users/interfaces/user-response.interface';
import { RelationshipStatus } from '../schemas/relationship.schema';

export interface RelationshipWithOtherUserResponse extends UserBasicInfoResponse {
  id: string | null;
  status: RelationshipStatus | null;
  createdAt: Date | null;
}

export interface RelationshipResponse {
  id: string;
  user1Id: string;
  user2Id: string;
  status: RelationshipStatus;
  initiator: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RelationshipCountResponse {
  acceptedFriendCount: number;
  pendingRequestCount: number;
}
