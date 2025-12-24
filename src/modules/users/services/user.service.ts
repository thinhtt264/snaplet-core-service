import { Injectable } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { User } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { IUserProfileResponse } from '../interfaces/user-response.interface';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Tạo user mới với password đã được hash
   * Lưu ý: Validation (email/username unique) phải được thực hiện trước khi gọi method này
   */
  async createUser(userData: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<User> {
    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Tạo user mới
    return this.userRepository.create({
      email: userData.email,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
    });
  }

  async getUserInfoByUsername(
    username: string,
  ): Promise<IUserProfileResponse | null> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
