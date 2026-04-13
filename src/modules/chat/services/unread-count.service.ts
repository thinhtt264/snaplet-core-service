import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, isNull, ne } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class UnreadCountService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

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
