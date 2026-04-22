import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';
import {
  CHAT_MESSAGE_READ,
  ChatMessageReadEventPayload,
} from '../events/chat-socket-events';
import { ChatGateway } from '../gateway/chat.gateway';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { MessageResponse } from '../interfaces/message.response';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ReadReceiptService {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
    private readonly cacheService: CacheService,
  ) {}

  async markRead(
    convId: string,
    userId: string,
    messageId: string,
    socketId?: string,
  ): Promise<void> {
    const msgRows = await this.db
      .select({ createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.id, messageId),
          eq(schema.messages.conversationId, convId),
        ),
      )
      .limit(1);

    if (!msgRows.length) return;
    const messageCreatedAt = msgRows[0].createdAt;

    // Only update if the new message is newer than the current last read,
    // preventing race conditions when client sends events out of order.
    // Use RETURNING to detect whether the row actually changed — if not,
    // the client already has up-to-date state and we skip the broadcast.
    const updated = await this.db
      .update(schema.conversationMembers)
      .set({ lastReadMessageId: messageId })
      .where(
        and(
          eq(schema.conversationMembers.conversationId, convId),
          eq(schema.conversationMembers.userId, userId),
          sql`(
            ${schema.conversationMembers.lastReadMessageId} IS NULL
            OR (
              SELECT created_at FROM messages WHERE id = ${messageId} AND conversation_id = ${convId}
            ) > (
              SELECT created_at FROM messages WHERE id = ${schema.conversationMembers.lastReadMessageId}
            )
          )`,
        ),
      )
      .returning({ conversationId: schema.conversationMembers.conversationId });

    if (!updated.length) return;

    const readAt = new Date();
    this.gateway.broadcastToRoom(
      convId,
      CHAT_MESSAGE_READ,
      {
        userId,
        messageId,
        messageCreatedAt,
        readAt,
      } as ChatMessageReadEventPayload,
      socketId,
    );

    const lastMessage = await this.cacheService.get<MessageResponse>(
      REDIS_KEY_FEATURES.CHAT_CONV_LAST_MESSAGE,
      convId,
    );

    void this.gateway.notifyConversationUpdated(
      convId,
      userId,
      { conversationId: convId, lastMessage, partnerLastReadAt: readAt },
      { conversationId: convId, lastMessage, myLastReadAt: readAt },
    );
  }
}
