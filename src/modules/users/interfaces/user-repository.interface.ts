import { User } from '../schemas/user.schema';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(userData: Partial<User>): Promise<User>;
}
