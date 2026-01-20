import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaRepository } from '../repositories/media.repository';

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cleanup orphaned media every hour
   * Orphaned media = media that is READY or PENDING but not referenced in any post
   * and older than configured hours (default: 24 hours / 1 day)
   */
  @Cron(CronExpression.EVERY_HOUR)
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

      const mediaIds = orphanedMedia.map((media) => media._id);
      const deletedCount = await this.mediaRepository.hardDeleteMany(mediaIds);

      this.logger.log(
        `Successfully hard deleted ${deletedCount} orphaned media items`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to cleanup orphaned media: ${error.message}`,
        error.stack,
      );
    }
  }
}
