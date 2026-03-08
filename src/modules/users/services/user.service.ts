import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../schemas/user.schema';
import {
  AvatarUploadRequestResponse,
  IUserProfileResponse,
} from '../interfaces/user-response.interface';
import { UserRepository } from '../repositories/user.repository';
import * as bcrypt from 'bcrypt';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { buildRedisKey } from '@common/utils/redis.utils';
import { RedisService } from '@common/redis/redis.service';
import { randomBytes } from 'crypto';
import { AVATAR_V1_FOLDER, MAX_AVATAR_FILE_SIZE } from '@common/constants';
import { StorageService } from '@infrastructure/storage/storage.service';
import { ImageSizeKey } from '@common/types';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
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

    return this.transformUserToProfile(user);
  }

  async requestAvatarUpload(
    userId: string,
    mimeType: string,
    size: number,
  ): Promise<AvatarUploadRequestResponse> {
    if (size > MAX_AVATAR_FILE_SIZE) {
      throw new BadRequestException(
        `Avatar file size (${size} bytes) exceeds maximum allowed size (${MAX_AVATAR_FILE_SIZE} bytes)`,
      );
    }

    const key = `${AVATAR_V1_FOLDER}/${userId}-${Date.now()}-${randomBytes(4).toString('hex')}`;

    const uploadUrl = await this.storageService.generatePresignedUploadUrl(
      key,
      mimeType,
    );

    return {
      uploadUrl,
      key,
      maxSizeBytes: MAX_AVATAR_FILE_SIZE,
    };
  }

  async confirmAvatarUpload(
    userId: string,
    key: string,
  ): Promise<IUserProfileResponse> {
    const expectedPrefix = `${AVATAR_V1_FOLDER}/${userId}-`;
    if (!key.startsWith(expectedPrefix)) {
      throw new BadRequestException('Invalid avatar key for current user');
    }

    const [realFileSize, currentUser] = await Promise.all([
      this.storageService.getRealFileSize(key),
      this.userRepository.findActiveById(userId),
    ]);

    if (realFileSize > MAX_AVATAR_FILE_SIZE) {
      this.storageService.deleteFile(key).catch(() => undefined);
      throw new BadRequestException(
        `Avatar file size (${realFileSize} bytes) exceeds maximum allowed size (${MAX_AVATAR_FILE_SIZE} bytes)`,
      );
    }

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    const images = this.storageService.getImageUrls(key, [ImageSizeKey.XS]);
    const avatarUrl =
      images?.[ImageSizeKey.XS] ?? this.storageService.getDefaultImageUrl(key);

    const updatedUser = await this.userRepository.updateAvatarUrl(
      userId,
      avatarUrl,
    );

    if (!updatedUser) {
      throw new NotFoundException('Unable to update avatar');
    }

    const oldKey = this.storageService.getKeyFromImageUrl(
      currentUser.avatarUrl,
    );
    if (
      oldKey &&
      oldKey !== key &&
      oldKey.startsWith(`${AVATAR_V1_FOLDER}/${userId}-`)
    ) {
      setImmediate(() => {
        this.storageService.deleteFile(oldKey).catch(() => undefined);
      });
    }

    return this.transformUserToProfile(updatedUser);
  }

  async deleteAvatar(userId: string): Promise<IUserProfileResponse> {
    const user = await this.userRepository.findActiveById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentAvatarUrl = user.avatarUrl;

    setImmediate(() => {
      this.userRepository.updateAvatarUrl(userId, '').catch(() => undefined);
      if (currentAvatarUrl) {
        const key = this.storageService.getKeyFromImageUrl(currentAvatarUrl);
        if (key?.startsWith(`${AVATAR_V1_FOLDER}/${userId}-`)) {
          this.storageService.deleteFile(key).catch(() => undefined);
        }
      }
    });

    return { ...this.transformUserToProfile(user), avatarUrl: '' };
  }

  private transformUserToProfile(user: User): IUserProfileResponse {
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
