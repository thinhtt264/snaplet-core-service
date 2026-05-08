import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';
import { MessageReactionRecordResponse } from '../interfaces/message.response';

type DrizzleClient = PostgresJsDatabase<typeof schema>;
interface MessageReactionMutationResult {
  actorEmoji: string | null;
  reactions: MessageReactionRecordResponse[];
}

interface MessageReactionRow {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date | string;
}

@Injectable()
export class MessageReactionRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async upsertToggle(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageReactionMutationResult> {
    const existingRows = await this.db
      .select({ emoji: schema.messageReactions.emoji })
      .from(schema.messageReactions)
      .where(
        sql`${schema.messageReactions.messageId} = ${messageId}::uuid AND ${schema.messageReactions.userId} = ${userId}`,
      )
      .limit(1);

    let actorEmoji: string | null = null;
    if (existingRows[0]?.emoji === emoji) {
      await this.db
        .delete(schema.messageReactions)
        .where(
          sql`${schema.messageReactions.messageId} = ${messageId}::uuid AND ${schema.messageReactions.userId} = ${userId}`,
        );
    } else {
      await this.db
        .insert(schema.messageReactions)
        .values({
          messageId,
          userId,
          emoji,
        })
        .onConflictDoUpdate({
          target: [
            schema.messageReactions.messageId,
            schema.messageReactions.userId,
          ],
          set: {
            emoji,
          },
        });
      actorEmoji = emoji;
    }

    const reactions = await this.findByMessageId(messageId);
    return { actorEmoji, reactions };
  }

  async findByMessageId(
    messageId: string,
  ): Promise<MessageReactionRecordResponse[]> {
    const rows = await this.db
      .select()
      .from(schema.messageReactions)
      .where(eq(schema.messageReactions.messageId, messageId))
      .orderBy(
        asc(schema.messageReactions.createdAt),
        asc(schema.messageReactions.id),
      );

    return rows.map(this.toReactionResponse);
  }

  async findByMessageIds(
    messageIds: string[],
  ): Promise<Map<string, MessageReactionRecordResponse[]>> {
    if (!messageIds.length) return new Map();

    const rows = await this.db
      .select()
      .from(schema.messageReactions)
      .where(inArray(schema.messageReactions.messageId, messageIds))
      .orderBy(
        asc(schema.messageReactions.messageId),
        asc(schema.messageReactions.createdAt),
        asc(schema.messageReactions.id),
      );

    const grouped = new Map<string, MessageReactionRecordResponse[]>();
    for (const row of rows) {
      const mapped = this.toReactionResponse(row);
      const current = grouped.get(mapped.messageId);
      if (current) {
        current.push(mapped);
        continue;
      }
      grouped.set(mapped.messageId, [mapped]);
    }
    return grouped;
  }

  private toReactionResponse(
    row: typeof schema.messageReactions.$inferSelect | MessageReactionRow,
  ): MessageReactionRecordResponse {
    return {
      id: row.id,
      messageId: row.messageId,
      userId: row.userId,
      emoji: row.emoji,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    };
  }
}
