import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { intersect } from 'drizzle-orm/pg-core';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ConversationRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findDirectBetween(userA: string, userB: string) {
    // Find a conversation that both users are members of
    const memberA = this.db
      .select({ conversationId: schema.conversationMembers.conversationId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, userA));

    const memberB = this.db
      .select({ conversationId: schema.conversationMembers.conversationId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, userB));

    const rows = await intersect(memberA, memberB).limit(1);

    if (!rows.length) return null;

    return this.findById(rows[0].conversationId);
  }

  async create(userA: string, userB: string) {
    const [conversation] = await this.db
      .insert(schema.conversations)
      .values({})
      .returning();

    await this.db.insert(schema.conversationMembers).values([
      { conversationId: conversation.id, userId: userA },
      { conversationId: conversation.id, userId: userB },
    ]);

    return conversation;
  }

  async updateLastMessageAt(convId: string, timestamp: Date) {
    await this.db
      .update(schema.conversations)
      .set({ lastMessageAt: timestamp })
      .where(eq(schema.conversations.id, convId));
  }

  async findAllByUserId(
    userId: string,
    cursor?: { lastMessageAt: Date | null; id: string },
    limit: number = 20,
  ) {
    // Keyset pagination on (lastMessageAt DESC NULLS LAST, id DESC).
    // NULL lastMessageAt rows sort last, so when cursor is null we only page
    // within the null bucket (same-null, smaller id).
    const cursorClause = cursor
      ? cursor.lastMessageAt
        ? or(
            lt(schema.conversations.lastMessageAt, cursor.lastMessageAt),
            and(
              eq(schema.conversations.lastMessageAt, cursor.lastMessageAt),
              lt(schema.conversations.id, cursor.id),
            ),
          )
        : and(
            isNull(schema.conversations.lastMessageAt),
            lt(schema.conversations.id, cursor.id),
          )
      : undefined;

    const rows = await this.db
      .select({
        conversation: schema.conversations,
        member: schema.conversationMembers,
      })
      .from(schema.conversationMembers)
      .innerJoin(
        schema.conversations,
        eq(schema.conversationMembers.conversationId, schema.conversations.id),
      )
      .where(and(eq(schema.conversationMembers.userId, userId), cursorClause))
      .orderBy(
        sql`${schema.conversations.lastMessageAt} DESC NULLS LAST, ${schema.conversations.id} DESC`,
      )
      .limit(limit + 1);

    return rows;
  }

  async getMember(convId: string, userId: string) {
    const rows = await this.db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, convId),
          eq(schema.conversationMembers.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async getMemberUserIds(convId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: schema.conversationMembers.userId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, convId));
    return rows.map((r) => r.userId);
  }

  async delete(convId: string): Promise<void> {
    await this.db
      .delete(schema.conversations)
      .where(eq(schema.conversations.id, convId));
  }

  async getPartnerUserId(
    convId: string,
    userId: string,
  ): Promise<string | null> {
    const rows = await this.db
      .select({ userId: schema.conversationMembers.userId })
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, convId),
          sql`${schema.conversationMembers.userId} != ${userId}`,
        ),
      )
      .limit(1);
    return rows[0]?.userId ?? null;
  }

  async getBothReadAtBatch(
    convIds: string[],
    userId: string,
  ): Promise<{
    myLastReadAtMap: Map<string, Date | null>;
    partnerLastReadAtMap: Map<string, Date | null>;
  }> {
    if (!convIds.length) {
      return { myLastReadAtMap: new Map(), partnerLastReadAtMap: new Map() };
    }

    const rows = await this.db
      .select({
        conversationId: schema.conversationMembers.conversationId,
        memberId: schema.conversationMembers.userId,
        lastReadCreatedAt: schema.messages.createdAt,
      })
      .from(schema.conversationMembers)
      .leftJoin(
        schema.messages,
        eq(schema.messages.id, schema.conversationMembers.lastReadMessageId),
      )
      .where(inArray(schema.conversationMembers.conversationId, convIds));

    const myLastReadAtMap = new Map<string, Date | null>();
    const partnerLastReadAtMap = new Map<string, Date | null>();

    for (const r of rows) {
      if (r.memberId === userId) {
        myLastReadAtMap.set(r.conversationId, r.lastReadCreatedAt ?? null);
      } else {
        partnerLastReadAtMap.set(r.conversationId, r.lastReadCreatedAt ?? null);
      }
    }

    return { myLastReadAtMap, partnerLastReadAtMap };
  }

  async getPartnerUserIdsBatch(
    convIds: string[],
    userId: string,
  ): Promise<Map<string, string>> {
    if (!convIds.length) return new Map();
    const rows = await this.db
      .select({
        conversationId: schema.conversationMembers.conversationId,
        partnerId: schema.conversationMembers.userId,
      })
      .from(schema.conversationMembers)
      .where(
        and(
          inArray(schema.conversationMembers.conversationId, convIds),
          ne(schema.conversationMembers.userId, userId),
        ),
      );
    return new Map(
      rows.map((r): [string, string] => [r.conversationId, r.partnerId]),
    );
  }
}
