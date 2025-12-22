import { Types } from 'mongoose';

export interface IRelationshipRepository {
  findAcceptedFriendIds(userId: Types.ObjectId): Promise<Types.ObjectId[]>;

  findAcceptedFriendsWithUserInfo(userId: Types.ObjectId): Promise<any[]>;
}
