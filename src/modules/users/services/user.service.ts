import { Injectable } from '@nestjs/common';
import { User } from '../schemas/user.schema';
import { IUserProfileResponse } from '../interfaces/user-response.interface';
import { UserRepository } from '../repositories/user.repository';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username);
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async createUser(userData: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);

    return this.userRepository.create({
      email: userData.email,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
    });
  }

  async getUserProfileByUsername(
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
