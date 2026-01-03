import { User } from '../schemas/user.schema';

export interface IUserRepository {
  findActiveByEmail(email: string): Promise<User | null>;
  findActiveByUsername(username: string): Promise<User | null>;
  findActiveById(id: string): Promise<User | null>;
  checkEmailExists(email: string): Promise<boolean>;
  checkUsernameExists(username: string): Promise<boolean>;
  create(userData: Partial<User>): Promise<User>;
}
