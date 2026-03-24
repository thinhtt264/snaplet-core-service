import { User } from '../schemas/user.schema';
import { SearchUserBasicInfoWithRelationshipStatusRaw } from './search-users.interface';

export interface IUserRepository {
  findActiveByEmail(email: string): Promise<User | null>;
  findActiveByUsername(username: string): Promise<User | null>;
  findActiveById(id: string): Promise<User | null>;
  checkEmailExists(email: string): Promise<boolean>;
  checkUsernameExists(username: string): Promise<boolean>;
  create(userData: Partial<User>): Promise<User>;

  /**
   * Search users by username prefix (shared cache for raw user list)
   * and "join" relationship status with the requester.
   */
  searchByUsernameWithRelationship(
    requesterId: string,
    query: string,
    limit: number,
    cacheTtlSeconds: number,
  ): Promise<SearchUserBasicInfoWithRelationshipStatusRaw[]>;
}
