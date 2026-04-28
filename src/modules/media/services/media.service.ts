import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { MediaRepository } from '../repositories/media.repository';
import { Media, MediaStatus } from '../schemas/media.schema';
import { MediaUploadItem } from '../dto/request-batch-upload.dto';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import {
  MediaBaseResponse,
  BatchUploadRequestResponse,
  BatchUploadItemResponse,
  ConfirmUploadResponse,
} from '../interfaces/media-response.interface';
import { StorageService } from '@infrastructure/storage/storage.service';
import { CacheService } from '@modules/cache/cache.service';
import {
  IMAGE_V1_FOLDER,
  MAX_MEDIA_FILE_SIZE,
  POST_CREATE_DAILY_LIMIT,
  REDIS_KEY_FEATURES,
} from '@common/constants';
import { ImageSizeKey } from '@common/types';
import type { ImageSizesResponse } from '@common/types';
import { RedisService } from '@common/redis/redis.service';
import { buildRedisKey, throwPostCreateLimitExceeded } from '@common/utils';

const MEDIA_SIZE_KEYS: ImageSizeKey[] = [
  ImageSizeKey.XS,
  ImageSizeKey.SM,
  ImageSizeKey.MD,
  ImageSizeKey.XL,
];

@Injectable()
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly storageService: StorageService,
    private readonly cacheService: CacheService,
    private readonly redisService: RedisService,
  ) {}

  async requestBatchUpload(
    ownerId: string,
    mediaItems: MediaUploadItem[],
  ): Promise<BatchUploadRequestResponse> {
    try {
      await this.assertCanCreatePost(ownerId);
      const items: BatchUploadItemResponse[] = [];

      for (const item of mediaItems) {
        const mediaId = new Types.ObjectId();
        const mediaKey = `${IMAGE_V1_FOLDER}/${mediaId.toString()}`;

        const media = await this.mediaRepository.create({
          _id: mediaId,
          ownerId: new Types.ObjectId(ownerId),
          mimeType: item.mimeType,
          mediaKey,
          width: item.width,
          height: item.height,
          transform: item.transform,
          status: MediaStatus.PENDING,
        });

        const uploadUrl = await this.generateSignedUploadUrl(
          mediaKey,
          item.mimeType,
        );

        items.push({
          mediaId: media._id.toString(),
          uploadUrl,
          expiresIn: this.storageService.getPresignedUrlExpiresIn(),
        });
      }

      return { data: items };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to request batch upload',
      );
    }
  }

  private async assertCanCreatePost(userId: string): Promise<void> {
    // Soft dependency: allow request when Redis is unavailable.
    if (!this.redisService.isRedisAvailable()) {
      return;
    }

    const redisKey = buildRedisKey(
      REDIS_KEY_FEATURES.POST_CREATE_DAILY_LIMIT,
      userId,
    );
    const currentRaw = await this.redisService.get(redisKey);
    const currentCount = Number.parseInt(currentRaw ?? '0', 10);
    const safeCurrentCount = Number.isFinite(currentCount) ? currentCount : 0;

    if (safeCurrentCount >= POST_CREATE_DAILY_LIMIT) {
      const ttl = await this.redisService.ttl(redisKey);
      const hoursRemaining = ttl > 0 ? Math.ceil(ttl / 3600) : 24;
      throwPostCreateLimitExceeded(
        POST_CREATE_DAILY_LIMIT,
        safeCurrentCount,
        hoursRemaining,
      );
    }
  }

  async confirmUpload(
    ownerId: string,
    dto: ConfirmUploadDto,
  ): Promise<ConfirmUploadResponse> {
    try {
      await this.assertCanCreatePost(ownerId);
      const ownerObjectId = new Types.ObjectId(ownerId);
      const mediaIds = dto.mediaIds.map((id) => new Types.ObjectId(id));
      const confirmedMedia: MediaBaseResponse[] = [];

      for (const mediaId of mediaIds) {
        const existingMedia = await this.mediaRepository.findById(mediaId);
        if (!existingMedia || !existingMedia.mediaKey) {
          throw new BadRequestException(
            `Media key not found for mediaId: ${mediaId.toString()}`,
          );
        }

        const mediaKey = existingMedia.mediaKey;

        const realFileSize =
          await this.storageService.getRealFileSize(mediaKey);
        if (realFileSize > MAX_MEDIA_FILE_SIZE) {
          throw new BadRequestException(
            `File size (${realFileSize} bytes) exceeds maximum allowed size (${MAX_MEDIA_FILE_SIZE} bytes) for mediaId: ${mediaId.toString()}`,
          );
        }

        // Atomic update: Only update if status is PENDING AND ownerId matches
        // This prevents:
        // 1. Race condition where multiple requests try to confirm the same media
        // 2. Unauthorized access where user tries to confirm someone else's media
        const updatedMedia = await this.mediaRepository.updateStatusIfWithOwner(
          mediaId,
          ownerObjectId,
          MediaStatus.PENDING,
          MediaStatus.PROCESSING,
          {
            mediaKey,
          },
        );

        if (!updatedMedia) {
          throw new BadRequestException(
            `Media not found, does not belong to user, or is not in PENDING status for mediaId: ${mediaId.toString()}`,
          );
        }

        await this.processMedia(updatedMedia._id);

        const finalMedia = await this.mediaRepository.findById(mediaId);
        if (!finalMedia) {
          throw new NotFoundException(
            `Media not found after processing for mediaId: ${mediaId.toString()}`,
          );
        }

        confirmedMedia.push(this.transformMedia(finalMedia));
      }

      return {
        media: confirmedMedia,
        message:
          confirmedMedia.length === 1
            ? 'Upload confirmed and processing started'
            : `${confirmedMedia.length} uploads confirmed and processing started`,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to confirm upload',
      );
    }
  }

  async assertMediaReadyAndOwned(
    mediaIds: string[],
    ownerId: string,
  ): Promise<void> {
    const objectIds = mediaIds.map((id) => new Types.ObjectId(id));

    const count = await this.mediaRepository.countDocuments({
      _id: { $in: objectIds },
      ownerId: new Types.ObjectId(ownerId),
      status: MediaStatus.READY,
      isDeleted: { $ne: true },
    });

    if (count !== objectIds.length) {
      throw new BadRequestException(
        'Some media is not READY or not owned by user',
      );
    }
  }

  async validateMediaReady(mediaIds: string[]): Promise<boolean> {
    const objectIds = mediaIds.map((id) => new Types.ObjectId(id));
    const media = await this.mediaRepository.findByIds(objectIds);

    if (media.length !== mediaIds.length) {
      return false;
    }

    return media.every((m) => m.status === MediaStatus.READY);
  }

  private async processMedia(mediaId: Types.ObjectId): Promise<void> {
    await this.mediaRepository.updateStatusIf(
      mediaId,
      MediaStatus.PROCESSING,
      MediaStatus.READY,
    );

    await this.cacheService.invalidateByTag(`media:${mediaId.toString()}`);
  }

  private async generateSignedUploadUrl(
    key: string,
    mimeType: string,
  ): Promise<string> {
    return this.storageService.generatePresignedUploadUrl(key, mimeType);
  }

  /**
   * Build image URLs (original + sizes) from storage key. Same pattern as avatar.
   * @param options.sizes - Which CDN sizes to include (default: XS, SM, MD, XL). Omitted sizes are ''.
   */
  getImageSizesForKey(
    key: string | undefined | null,
    options?: { sizes?: ImageSizeKey[] },
  ): ImageSizesResponse {
    const sizes = options?.sizes ?? MEDIA_SIZE_KEYS;
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

  private transformMedia(media: Media): MediaBaseResponse {
    const images = this.getImageSizesForKey(media.mediaKey);
    return {
      id: media._id.toString(),
      ownerId: media.ownerId.toString(),
      mimeType: media.mimeType,
      images,
      duration: media.duration,
      width: media.width,
      height: media.height,
      transform: media.transform,
      status: media.status,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }
}
