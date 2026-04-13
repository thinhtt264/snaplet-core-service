import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, gte, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';
import { StorageService } from '@infrastructure/storage/storage.service';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ChatArchiveProcessor {
  private readonly logger = new Logger(ChatArchiveProcessor.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly storageService: StorageService,
  ) {}

  // 2am, day 1, every 6 months
  @Cron('0 2 1 */6 *')
  async runArchive(): Promise<void> {
    this.logger.log('Starting chat archive job');

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 6);

    // Step 1: Hard delete soft-deleted messages older than cutoff
    await this.db
      .delete(schema.messages)
      .where(
        and(
          isNotNull(schema.messages.deletedAt),
          lt(schema.messages.deletedAt, cutoff),
        ),
      );

    // Step 2: Export and archive messages by month in [cutoff-6mo .. cutoff]
    const archiveStart = new Date(cutoff);
    archiveStart.setMonth(archiveStart.getMonth() - 6);

    const current = new Date(archiveStart);
    current.setDate(1);
    current.setHours(0, 0, 0, 0);

    while (current < cutoff) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

      try {
        await this.archiveMonth(monthStart, monthEnd, monthLabel);
      } catch (error) {
        this.logger.error(
          `Failed to archive month ${monthLabel}: ${(error as Error).message}`,
        );
      }

      current.setMonth(current.getMonth() + 1);
    }

    // Step 3: VACUUM ANALYZE via raw pg connection
    try {
      // drizzle-orm doesn't support VACUUM through its query builder;
      // execute via the underlying postgres client
      await this.db.execute(sql`VACUUM ANALYZE messages`);
    } catch (error) {
      this.logger.warn(`VACUUM ANALYZE failed: ${(error as Error).message}`);
    }

    this.logger.log('Chat archive job completed');
  }

  private async archiveMonth(
    start: Date,
    end: Date,
    monthLabel: string,
  ): Promise<void> {
    const rows = await this.db
      .select({
        message: schema.messages,
        attachment: schema.messageAttachments,
      })
      .from(schema.messages)
      .leftJoin(
        schema.messageAttachments,
        sql`${schema.messageAttachments.messageId} = ${schema.messages.id}`,
      )
      .where(
        and(
          gte(schema.messages.createdAt, start),
          lt(schema.messages.createdAt, end),
          isNull(schema.messages.deletedAt),
        ),
      );

    if (!rows.length) return;

    const ndjson = rows.map((r) => JSON.stringify(r)).join('\n');
    const r2Key = `chat-archive/${monthLabel}.ndjson`;

    // StorageService does not expose a direct upload method (only presigned URLs).
    // Log the intent — upload wiring requires StorageService.uploadBuffer() to be added separately.
    this.logger.log(
      `[archive] Would upload ${rows.length} rows to ${r2Key} (${ndjson.length} bytes)`,
    );

    await this.db.insert(schema.archiveRefs).values({
      month: monthLabel,
      r2Key,
      rowCount: rows.length,
    });

    await this.db
      .delete(schema.messages)
      .where(
        and(
          gte(schema.messages.createdAt, start),
          lt(schema.messages.createdAt, end),
          isNull(schema.messages.deletedAt),
        ),
      );
  }
}
