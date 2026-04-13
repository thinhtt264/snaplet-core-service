import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';
import { CHAT_MESSAGE_READ } from '../events/chat-socket-events';
import { ChatGateway } from '../gateway/chat.gateway';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ReadReceiptService {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly gateway: ChatGateway,
  ) {}

  async markRead(
    convId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    // Only update if the new message is newer than the current last read,
    // preventing race conditions when client sends events out of order.
    await this.db
      .update(schema.conversationMembers)
      .set({ lastReadMessageId: messageId })
      .where(
        and(
          eq(schema.conversationMembers.conversationId, convId),
          eq(schema.conversationMembers.userId, userId),
          sql`(
            ${schema.conversationMembers.lastReadMessageId} IS NULL
            OR (
              SELECT created_at FROM messages WHERE id = ${messageId}
            ) > (
              SELECT created_at FROM messages WHERE id = ${schema.conversationMembers.lastReadMessageId}
            )
          )`,
        ),
      );

    const readAt = new Date().toISOString();
    this.gateway.broadcastToRoom(convId, CHAT_MESSAGE_READ, {
      userId,
      messageId,
      readAt,
    });
  }
}
