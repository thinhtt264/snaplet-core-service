import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@database/postgres/postgres.provider';
import * as schema from '@database/postgres/schema';
import {
  CHAT_MESSAGE_READ,
  ChatMessageReadEventPayload,
} from '../events/chat-socket-events';
import { ChatGateway } from '../gateway/chat.gateway';
import { ConversationRepository } from '../repositories/conversation.repository';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ReadReceiptService {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
    private readonly conversationRepository: ConversationRepository,
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

    const advanced = await this.conversationRepository.advanceLastRead(
      convId,
      userId,
      messageId,
      messageCreatedAt,
    );

    if (!advanced) return;

    this.gateway.broadcastToRoom(
      convId,
      CHAT_MESSAGE_READ,
      {
        userId,
        messageId,
        messageCreatedAt,
        readAt: new Date(),
      } as ChatMessageReadEventPayload,
      socketId,
    );
  }
}
