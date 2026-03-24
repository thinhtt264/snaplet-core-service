import type { RelationshipStatus } from '@modules/relationships/schemas/relationship.schema';
import type { UserBasicInfoResponse } from './user-response.interface';

// Raw shape from DB/Redis for internal repository/service usage.
export interface RawSearchUser {
  _id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarKey: string | null;
}

type UserBasicInfoRawAvatarKey = Omit<UserBasicInfoResponse, 'avatarUrls'> & {
  avatarKey: string | null;
};

// Raw join result returned by repository.
export interface SearchUserBasicInfoWithRelationshipStatusRaw extends UserBasicInfoRawAvatarKey {
  id: string | null;
  status: RelationshipStatus | null;
  createdAt: Date | null;
  initiator: string | null;
}
