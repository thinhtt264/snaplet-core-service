import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class UnreadCountService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getHasUnreadBatch(
    convIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    if (!convIds.length) return new Map();

    const convIdsArray = `{${convIds.join(',')}}`;

    const rows = await this.db.execute<{
      conversation_id: string;
      has_unread: boolean;
    }>(sql`
      SELECT
        cm.conversation_id,
        EXISTS (
          SELECT 1 FROM messages m
          LEFT JOIN messages lrm ON lrm.id = cm.last_read_message_id
          WHERE m.conversation_id = cm.conversation_id
            AND m.sender_id != ${userId}
            AND m.deleted_at IS NULL
            AND (
              cm.last_read_message_id IS NULL
              OR m.created_at > lrm.created_at
            )
        ) AS has_unread
      FROM conversation_members cm
      WHERE cm.conversation_id = ANY(${convIdsArray}::uuid[])
        AND cm.user_id = ${userId}
    `);

    return new Map(rows.map((r) => [r.conversation_id, r.has_unread]));
  }
}
