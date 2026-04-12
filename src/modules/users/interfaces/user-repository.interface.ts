import { User } from '../schemas/user.schema';
import { SearchUserBasicInfoWithRelationshipStatusRaw } from './search-users.interface';

export interface IUserRepository {
  findActiveByEmail(email: string): Promise<User | null>;
  findActiveByUsername(username: string): Promise<User | null>;
  findActiveById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  linkGoogleId(userId: string, googleId: string): Promise<User>;
  checkEmailExists(email: string): Promise<boolean>;
  checkUsernameExists(username: string): Promise<boolean>;
  create(userData: Partial<User>): Promise<User>;
  update(userId: string, update: Partial<User>): Promise<User | null>;

  /**
   * Search users by username prefix (shared cache for raw user list)
   * and "join" relationship status with the requester.
   */
  searchByUsernameWithRelationship(
    requesterId: string,
    query: string,
    limit: number,
  ): Promise<SearchUserBasicInfoWithRelationshipStatusRaw[]>;
}
