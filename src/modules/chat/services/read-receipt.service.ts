import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CHAT_MESSAGE_READ,
  ChatMessageReadEventPayload,
} from '../events/chat-socket-events';
import { ChatGateway } from '../gateway/chat.gateway';
import { ConversationRepository } from '../repositories/conversation.repository';

@Injectable()
export class ReadReceiptService {
  private readonly logger = new Logger(ReadReceiptService.name);

  constructor(
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
    try {
      const result = await this.conversationRepository.advanceLastRead(
        convId,
        userId,
        messageId,
      );

      if (!result) return;

      const readAt = new Date();
      this.gateway.broadcastToRoom(
        convId,
        CHAT_MESSAGE_READ,
        {
          conversationId: convId,
          userId,
          messageId,
          messageCreatedAt: result.messageCreatedAt,
          readAt,
        } satisfies ChatMessageReadEventPayload,
        socketId,
      );
    } catch (err) {
      this.logger.error(
        `[markRead] FAILED convId=${convId} userId=${userId} messageId=${messageId}`,
        err instanceof Error ? err.stack : err,
      );
      throw err;
    }
  }
}
