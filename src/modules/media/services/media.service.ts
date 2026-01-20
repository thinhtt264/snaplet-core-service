import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { MediaRepository } from '../repositories/media.repository';
import { Media, MediaStatus } from '../schemas/media.schema';
import { RequestBatchUploadDto } from '../dto/request-batch-upload.dto';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import {
  MediaResponse,
  BatchUploadRequestResponse,
  BatchUploadItemResponse,
  ConfirmUploadResponse,
} from '../interfaces/media-response.interface';

@Injectable()
export class MediaService {
  constructor(private readonly mediaRepository: MediaRepository) {}

  /**
   * Step 1: Request batch upload - Create multiple Media with PENDING status
   * Returns signed URLs for client to upload directly to storage
   */
  async requestBatchUpload(
    ownerId: string,
    dto: RequestBatchUploadDto,
  ): Promise<BatchUploadRequestResponse> {
    try {
      const items: BatchUploadItemResponse[] = [];

      // Create Media documents for each item
      for (const item of dto.items) {
        const media = await this.mediaRepository.create({
          ownerId: new Types.ObjectId(ownerId),
          type: item.type,
          status: MediaStatus.PENDING,
          originalUrl: '', // Will be updated after upload
        });

        // TODO: Generate signed URL from storage service (S3, GCS, etc.)
        // For now, return a placeholder
        const uploadUrl = await this.generateSignedUploadUrl(
          media._id.toString(),
          item.mimeType,
        );

        items.push({
          mediaId: media._id.toString(),
          uploadUrl,
          expiresIn: 3600, // 1 hour
        });
      }

      return { items };
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to request batch upload',
      );
    }
  }

  /**
   * Step 2: Confirm upload - Update Media with URL and trigger processing
   * Uses atomic update with owner check to prevent race condition and unauthorized access
   */
  async confirmUpload(
    ownerId: string,
    dto: ConfirmUploadDto,
  ): Promise<ConfirmUploadResponse> {
    try {
      const mediaId = new Types.ObjectId(dto.mediaId);
      const ownerObjectId = new Types.ObjectId(ownerId);

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
          originalUrl: dto.originalUrl,
          thumbnailUrl: dto.thumbnailUrl,
          width: dto.width,
          height: dto.height,
          duration: dto.duration,
        },
      );

      if (!updatedMedia) {
        throw new BadRequestException(
          'Media not found, does not belong to user, or is not in PENDING status',
        );
      }

      // TODO: Push image/video processing job to queue
      // In production, this should be handled by a background worker
      // For development, we'll simulate immediate processing
      await this.processMedia(updatedMedia._id);

      // Fetch the updated media after processing
      const finalMedia = await this.mediaRepository.findById(mediaId);
      if (!finalMedia) {
        throw new NotFoundException('Media not found after processing');
      }

      return {
        media: this.transformMedia(finalMedia),
        message: 'Upload confirmed and processing started',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to confirm upload',
      );
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(mediaId: string): Promise<MediaResponse> {
    const media = await this.mediaRepository.findById(
      new Types.ObjectId(mediaId),
    );
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    return this.transformMedia(media);
  }

  /**
   * Get media by IDs (for posts)
   */
  async getMediaByIds(mediaIds: string[]): Promise<MediaResponse[]> {
    const objectIds = mediaIds.map((id) => new Types.ObjectId(id));
    const media = await this.mediaRepository.findByIds(objectIds);
    return media.map((m) => this.transformMedia(m));
  }

  /**
   * Assert that all media IDs are READY and owned by the user
   * Throws BadRequestException if validation fails
   */
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

  /**
   * Validate media IDs are all READY
   * @deprecated Use assertMediaReadyAndOwned instead
   */
  async validateMediaReady(mediaIds: string[]): Promise<boolean> {
    const objectIds = mediaIds.map((id) => new Types.ObjectId(id));
    const media = await this.mediaRepository.findByIds(objectIds);

    if (media.length !== mediaIds.length) {
      return false;
    }

    return media.every((m) => m.status === MediaStatus.READY);
  }

  /**
   * Process media (resize, thumbnail generation, etc.)
   * TODO: In production, this should push a job to a queue (Bull, BullMQ, etc.)
   * and a worker will process it asynchronously
   * For now, we simulate immediate processing for development
   */
  private async processMedia(mediaId: Types.ObjectId): Promise<void> {
    // Simulate processing - in production this would be async via queue
    // For development, immediately mark as READY
    // Use atomic update to ensure we only update if status is PROCESSING
    // TODO: Replace with queue job: await this.queueService.add('process-media', { mediaId })
    await this.mediaRepository.updateStatusIf(
      mediaId,
      MediaStatus.PROCESSING,
      MediaStatus.READY,
    );
  }

  /**
   * Generate signed upload URL
   * TODO: Integrate with actual storage service (S3, GCS, etc.)
   */
  private async generateSignedUploadUrl(
    mediaId: string,
    mimeType: string,
  ): Promise<string> {
    // Placeholder - replace with actual storage service integration
    return `https://storage.example.com/upload/${mediaId}?mimeType=${mimeType}`;
  }

  /**
   * Transform media to response format
   */
  private transformMedia(media: Media): MediaResponse {
    return {
      id: media._id.toString(),
      ownerId: media.ownerId.toString(),
      type: media.type,
      originalUrl: media.originalUrl,
      thumbnailUrl: media.thumbnailUrl,
      width: media.width,
      height: media.height,
      duration: media.duration,
      status: media.status,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }
}
