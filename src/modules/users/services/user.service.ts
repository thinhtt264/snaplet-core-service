import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../schemas/user.schema';
import { IUserProfileResponse } from '../interfaces/user-response.interface';
import { UserRepository } from '../repositories/user.repository';
import * as bcrypt from 'bcrypt';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { buildRedisKey } from '@common/utils/redis.utils';
import { RedisService } from '@common/redis/redis.service';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
  ) {}

  async checkUserExists(userId: string): Promise<boolean> {
    // Build Redis key for user existence cache
    const redisKey = buildRedisKey(REDIS_KEY_FEATURES.USER_NOT_FOUND, userId);

    const cachedValue = await this.redisService.get(redisKey);

    if (cachedValue !== null) {
      return false;
    }

    // Cache miss - query database
    const user = await this.userRepository.findActiveById(userId);

    if (!user) {
      await this.redisService.set(redisKey, '1', 24 * 60 * 60);
      return false;
    }

    return true;
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
    const user = await this.userRepository.findActiveByUsername(username);

    if (!user) {
      throw new NotFoundException(`User not found`);
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
