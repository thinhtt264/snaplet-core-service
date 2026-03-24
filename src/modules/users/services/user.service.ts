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
import { randomBytes } from 'crypto';
import { AVATAR_V1_FOLDER, MAX_AVATAR_FILE_SIZE } from '@common/constants';
import { StorageService } from '@infrastructure/storage/storage.service';
import { ImageSizeKey, ImageSizesResponse } from '@common/types';
import { SearchUserItemResponse } from '../interfaces/user-search-response.interface';

const AVATAR_SIZE_KEYS: ImageSizeKey[] = [
  ImageSizeKey.XS,
  ImageSizeKey.SM,
  ImageSizeKey.MD,
];

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly storageService: StorageService,
  ) {}

  async checkUserExists(userId: string): Promise<boolean> {
    return this.userRepository.findActiveById(userId) !== null;
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

    return this.buildUserProfileResponse(user);
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

    const updatedUser = await this.userRepository.updateAvatarKey(userId, key);

    if (!updatedUser) {
      throw new NotFoundException('Unable to update avatar');
    }

    const oldKey = currentUser.avatarKey;
    if (
      oldKey &&
      oldKey !== key &&
      oldKey.startsWith(`${AVATAR_V1_FOLDER}/${userId}-`)
    ) {
      setImmediate(() => {
        this.storageService.deleteFile(oldKey).catch(() => undefined);
      });
    }

    return this.buildUserProfileResponse(updatedUser);
  }

  async deleteAvatar(userId: string): Promise<IUserProfileResponse> {
    const user = await this.userRepository.findActiveById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentKey = user.avatarKey;

    setImmediate(() => {
      this.userRepository.updateAvatarKey(userId, '').catch(() => undefined);
      if (
        currentKey &&
        currentKey.startsWith(`${AVATAR_V1_FOLDER}/${userId}-`)
      ) {
        this.storageService.deleteFile(currentKey).catch(() => undefined);
      }
    });

    return this.buildUserProfileResponse(user, '');
  }

  /**
   * Build avatar URLs from storage key. Domain logic for avatar response shape.
   * All fields are always string (never null/undefined).
   * @param options.sizes - Which CDN sizes to include (default: XS, SM, MD). Omitted sizes are returned as ''.
   */
  getAvatarUrlsForKey(
    key: string | undefined | null,
    options?: { sizes?: ImageSizeKey[] },
  ): ImageSizesResponse {
    const sizes = options?.sizes ?? AVATAR_SIZE_KEYS;
    const original = this.storageService.getDefaultImageUrl(key);
    const urls = this.storageService.getImageUrls(key, sizes);
    return {
      original: original ?? '',
      xs: urls?.[ImageSizeKey.XS] ?? '',
      sm: urls?.[ImageSizeKey.SM] ?? '',
      md: urls?.[ImageSizeKey.MD] ?? '',
      xl: urls?.[ImageSizeKey.XL] ?? '',
    };
  }

  /**
   * Build profile with avatarUrls (original + XS, SM, MD) from stored avatarKey.
   * Pass overrideAvatarKey (e.g. '') when deleting to return empty URLs. All URL fields are always string.
   */
  buildUserProfileResponse(
    user: User,
    overrideAvatarKey?: string,
  ): IUserProfileResponse {
    const key =
      overrideAvatarKey !== undefined ? overrideAvatarKey : user.avatarKey;
    const avatarUrls = this.getAvatarUrlsForKey(key);
    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrls,
      createdAt: user.createdAt,
    };
  }

  async updateDisplayName(
    userId: string,
    firstName: string,
    lastName: string,
  ): Promise<IUserProfileResponse> {
    const updatedUser = await this.userRepository.updateName(
      userId,
      firstName,
      lastName,
    );

    if (!updatedUser) {
      throw new NotFoundException('Unable to update display name');
    }

    return this.buildUserProfileResponse(updatedUser);
  }

  async searchUsers(
    query: string,
    limit: number,
    requesterId: string,
  ): Promise<SearchUserItemResponse[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return [];

    const joined = await this.userRepository.searchByUsernameWithRelationship(
      requesterId,
      trimmedQuery,
      limit,
    );

    return joined.map((user) => ({
      userId: user.userId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrls: this.getAvatarUrlsForKey(user.avatarKey),
      id: user.id,
      status: user.status,
      createdAt: user.createdAt,
      initiator: user.initiator,
    }));
  }
}
