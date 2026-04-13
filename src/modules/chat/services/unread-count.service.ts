import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class UnreadCountService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getCountsBatch(
    convIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    if (!convIds.length) return new Map();

    // Single query: LEFT JOIN conversation_members → last-read message → all unread messages.
    // Handles both cases (no read marker / has read marker) in one pass.
    const rows = await this.db.execute<{
      conversation_id: string;
      unread_count: number;
    }>(sql`
      SELECT
        cm.conversation_id,
        COUNT(m.id)::int AS unread_count
      FROM conversation_members cm
      LEFT JOIN messages lrm ON lrm.id = cm.last_read_message_id
      LEFT JOIN messages m
        ON m.conversation_id = cm.conversation_id
        AND m.sender_id != ${userId}
        AND m.deleted_at IS NULL
        AND (
          cm.last_read_message_id IS NULL
          OR m.created_at > lrm.created_at
        )
      WHERE cm.conversation_id = ANY(${convIds})
        AND cm.user_id = ${userId}
      GROUP BY cm.conversation_id
    `);

    return new Map(rows.map((r) => [r.conversation_id, r.unread_count ?? 0]));
  }

  async getCount(convId: string, userId: string): Promise<number> {
    const member = await this.db
      .select({
        lastReadMessageId: schema.conversationMembers.lastReadMessageId,
      })
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, convId),
          eq(schema.conversationMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!member.length) return 0;

    const lastReadId = member[0].lastReadMessageId;

    if (!lastReadId) {
      // No read marker — count all messages not from this user
      const result = await this.db
        .select({ value: count() })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, convId),
            ne(schema.messages.senderId, userId),
            isNull(schema.messages.deletedAt),
          ),
        );
      return result[0]?.value ?? 0;
    }

    // Count messages newer than the last read message
    const lastRead = await this.db
      .select({ createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(eq(schema.messages.id, lastReadId))
      .limit(1);

    if (!lastRead.length) return 0;

    const result = await this.db
      .select({ value: count() })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.conversationId, convId),
          ne(schema.messages.senderId, userId),
          isNull(schema.messages.deletedAt),
          gt(schema.messages.createdAt, lastRead[0].createdAt),
        ),
      );

    return result[0]?.value ?? 0;
  }
}
