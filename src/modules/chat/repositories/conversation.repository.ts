import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
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

  async findByPair(userA: string, userB: string) {
    const [lo, hi] = [userA, userB].sort();
    const rows = await this.db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.userA, lo),
          eq(schema.conversations.userB, hi),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** Atomically find-or-create. Returns { conversation, isNew }. */
  async findOrCreate(
    userA: string,
    userB: string,
  ): Promise<{
    conversation: typeof schema.conversations.$inferSelect;
    isNew: boolean;
  }> {
    const [lo, hi] = [userA, userB].sort();

    const inserted = await this.db
      .insert(schema.conversations)
      .values({ userA: lo, userB: hi })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      return { conversation: inserted[0], isNew: true };
    }

    const existing = await this.findByPair(lo, hi);
    return { conversation: existing!, isNew: false };
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
    const memberClause = or(
      eq(schema.conversations.userA, userId),
      eq(schema.conversations.userB, userId),
    );

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

    return this.db
      .select()
      .from(schema.conversations)
      .where(and(memberClause, cursorClause))
      .orderBy(
        sql`${schema.conversations.lastMessageAt} DESC NULLS LAST, ${schema.conversations.id} DESC`,
      )
      .limit(limit + 1);
  }

  async isMember(convId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, convId),
          or(
            eq(schema.conversations.userA, userId),
            eq(schema.conversations.userB, userId),
          ),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async getMemberUserIds(convId: string): Promise<string[]> {
    const conv = await this.findById(convId);
    return conv ? [conv.userA, conv.userB] : [];
  }

  async getPartnerUserId(
    convId: string,
    userId: string,
  ): Promise<string | null> {
    const conv = await this.findById(convId);
    if (!conv) return null;
    return conv.userA === userId ? conv.userB : conv.userA;
  }

  async delete(convId: string): Promise<void> {
    await this.db
      .delete(schema.conversations)
      .where(eq(schema.conversations.id, convId));
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

    // Step 1: fetch last-read message IDs from conversations
    const convRows = await this.db
      .select({
        id: schema.conversations.id,
        userA: schema.conversations.userA,
        userALastReadMsgId: schema.conversations.userALastReadMsgId,
        userBLastReadMsgId: schema.conversations.userBLastReadMsgId,
      })
      .from(schema.conversations)
      .where(inArray(schema.conversations.id, convIds));

    // Step 2: batch-fetch createdAt for all non-null lastReadMsgIds
    const allMsgIds = [
      ...convRows.map((r) => r.userALastReadMsgId),
      ...convRows.map((r) => r.userBLastReadMsgId),
    ].filter((id): id is string => id != null);

    const msgTimestampMap = new Map<string, Date>();
    if (allMsgIds.length > 0) {
      const msgs = await this.db
        .select({
          id: schema.messages.id,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(inArray(schema.messages.id, allMsgIds));
      for (const m of msgs) {
        msgTimestampMap.set(m.id, m.createdAt);
      }
    }

    const myLastReadAtMap = new Map<string, Date | null>();
    const partnerLastReadAtMap = new Map<string, Date | null>();

    for (const r of convRows) {
      const isUserA = r.userA === userId;
      const myMsgId = isUserA ? r.userALastReadMsgId : r.userBLastReadMsgId;
      const partnerMsgId = isUserA
        ? r.userBLastReadMsgId
        : r.userALastReadMsgId;
      myLastReadAtMap.set(
        r.id,
        myMsgId ? (msgTimestampMap.get(myMsgId) ?? null) : null,
      );
      partnerLastReadAtMap.set(
        r.id,
        partnerMsgId ? (msgTimestampMap.get(partnerMsgId) ?? null) : null,
      );
    }

    return { myLastReadAtMap, partnerLastReadAtMap };
  }

  /**
   * Validate the message exists in this conversation, resolve userA/userB slot,
   * then advance the pointer — all in 2 queries (1 JOIN + 1 UPDATE).
   * Returns messageCreatedAt for the caller to broadcast, or null if nothing changed.
   */
  async advanceLastRead(
    convId: string,
    userId: string,
    messageId: string,
  ): Promise<{ messageCreatedAt: Date } | null> {
    const [row] = await this.db
      .select({
        messageCreatedAt: schema.messages.createdAt,
        userA: schema.conversations.userA,
      })
      .from(schema.messages)
      .innerJoin(
        schema.conversations,
        eq(schema.conversations.id, schema.messages.conversationId),
      )
      .where(
        and(
          eq(schema.messages.id, messageId),
          eq(schema.messages.conversationId, convId),
          or(
            eq(schema.conversations.userA, userId),
            eq(schema.conversations.userB, userId),
          ),
        ),
      )
      .limit(1);

    if (!row) return null;

    const updateData =
      row.userA === userId
        ? { userALastReadMsgId: messageId }
        : { userBLastReadMsgId: messageId };

    await this.db
      .update(schema.conversations)
      .set(updateData)
      .where(eq(schema.conversations.id, convId));

    return { messageCreatedAt: row.messageCreatedAt };
  }
}
