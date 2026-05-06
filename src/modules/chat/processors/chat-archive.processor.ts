import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ChatArchiveProcessor {
  private readonly logger = new Logger(ChatArchiveProcessor.name);

  // 2am, day 1, every 6 months
  @Cron('0 2 1 */6 *')
  async runArchive(): Promise<void> {
    // TODO: Implement chat message archiving
    // Requirements:
    // 1. Hard-delete soft-deleted messages older than 6-month cutoff
    // 2. Export active messages (per month bucket) to R2 as NDJSON
    //    - Must upload successfully BEFORE deleting from DB (avoid data loss)
    //    - Process in paginated batches to avoid memory exhaustion
    //    - StorageService needs an uploadBuffer(key, buffer, contentType) method added
    // 3. Record each archived month in the archiveRefs table
    // 4. VACUUM ANALYZE should NOT be run here — leave it to PostgreSQL autovacuum
    this.logger.log('Chat archive job skipped — not yet implemented');
  }
}
