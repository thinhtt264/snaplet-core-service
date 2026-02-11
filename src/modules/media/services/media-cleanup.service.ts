import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Types } from 'mongoose';
import { MediaRepository } from '../repositories/media.repository';
import { StorageService } from '@infrastructure/storage/storage.service';

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Delete orphaned media files from storage
   * This method can be reused for manual cleanup or other scenarios
   * @param mediaList - List of media items to delete from storage
   * @param allowedStatuses - Statuses that are safe to delete (default: ['PENDING', 'READY'])
   * @returns Object with deletion statistics
   */
  async deleteOrphanedMediaFromStorage(
    mediaList: Array<{ _id: Types.ObjectId; mediaKey?: string }>,
    allowedStatuses: string[] = ['PENDING', 'READY'],
  ): Promise<{
    deletedCount: number;
    failedCount: number;
    skippedCount: number;
    mediaIdsToDelete: Types.ObjectId[];
  }> {
    let deletedFromStorageCount = 0;
    let failedToDeleteFromStorageCount = 0;
    let skippedCount = 0;
    const mediaIdsToDelete: Types.ObjectId[] = [];

    for (const media of mediaList) {
      // Verify media still exists and has expected status before deleting
      // This prevents race condition where media status changed between find and delete
      const currentMedia = await this.mediaRepository.findById(media._id);
      if (!currentMedia) {
        // Already deleted, skip
        skippedCount++;
        continue;
      }

      if (!allowedStatuses.includes(currentMedia.status)) {
        skippedCount++;
        continue;
      }

      // Delete file from R2 storage
      if (currentMedia.mediaKey) {
        try {
          await this.storageService.deleteFile(currentMedia.mediaKey);
          deletedFromStorageCount++;
        } catch (error: any) {
          failedToDeleteFromStorageCount++;
          this.logger.warn(
            `Failed to delete file from R2 storage for media ${media._id}: ${error.message}`,
          );
        }
      }

      mediaIdsToDelete.push(media._id);
    }

    return {
      deletedCount: deletedFromStorageCount,
      failedCount: failedToDeleteFromStorageCount,
      skippedCount,
      mediaIdsToDelete,
    };
  }

  /**
   * Cleanup orphaned media every hour
   * Orphaned media = media that is READY or PENDING but not referenced in any post
   * and older than configured hours (default: 24 hours / 1 day)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedMedia(): Promise<void> {
    this.logger.log('Starting orphaned media cleanup job...');

    try {
      const olderThanHours = this.configService.get<number>(
        'media.cleanup.olderThanHours',
        24, // default: 24 hours (1 day)
      );
      const orphanedMedia =
        await this.mediaRepository.findOrphanedMedia(olderThanHours);

      if (orphanedMedia.length === 0) {
        this.logger.log('No orphaned media found to cleanup');
        return;
      }

      // Delete files from R2 storage using reusable method
      const storageDeletionResult = await this.deleteOrphanedMediaFromStorage(
        orphanedMedia,
        ['PENDING', 'READY'],
      );

      const deletedCount =
        storageDeletionResult.mediaIdsToDelete.length > 0
          ? await this.mediaRepository.hardDeleteManyIfStatus(
              storageDeletionResult.mediaIdsToDelete,
              ['PENDING', 'READY'],
            )
          : 0;

      this.logger.log(
        `Successfully hard deleted ${deletedCount} orphaned media items`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to cleanup orphaned media: ${error.message}`,
        error.stack,
      );
    }
  }
}
