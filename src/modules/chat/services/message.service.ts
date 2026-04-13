import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { ChatGateway } from '../gateway/chat.gateway';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  MessageResponse,
  PaginatedMessages,
} from '../interfaces/message.response';
import {
  CHAT_MESSAGE_DELETED,
  CHAT_MESSAGE_NEW,
  CHAT_MESSAGE_PINNED,
  CHAT_MESSAGE_UNPINNED,
} from '../events/chat-socket-events';
import { CHAT_MESSAGE_PAGE_SIZE } from '@common/constants/chat.constants';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly gateway: ChatGateway,
  ) {}

  async send(dto: SendMessageDto, senderId: string): Promise<MessageResponse> {
    const message = await this.messageRepository.insertMessage({
      ...dto,
      senderId,
    });

    if (dto.attachments?.length) {
      await this.messageRepository.insertAttachments(
        message.id,
        dto.attachments,
      );
    }

    await this.conversationRepository.updateLastMessageAt(
      dto.conversationId,
      new Date(message.createdAt),
    );

    this.gateway.broadcastToRoom(dto.conversationId, CHAT_MESSAGE_NEW, message);

    return message;
  }

  async loadMessages(
    convId: string,
    userId: string,
    cursor?: string,
    limit: number = CHAT_MESSAGE_PAGE_SIZE,
  ): Promise<PaginatedMessages> {
    const member = await this.conversationRepository.getMember(convId, userId);
    if (!member) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    return this.messageRepository.findByConversation(convId, cursor, limit);
  }

  async softDelete(messageId: string, requesterId: string): Promise<void> {
    // Fetch message to get conversationId before deletion
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.messageRepository.softDelete(messageId, requesterId);

    this.gateway.broadcastToRoom(message.conversationId, CHAT_MESSAGE_DELETED, {
      messageId,
    });
  }

  async pinMessage(
    convId: string,
    messageId: string,
    requesterId: string,
  ): Promise<void> {
    const member = await this.conversationRepository.getMember(
      convId,
      requesterId,
    );
    if (!member) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    await this.messageRepository.pinMessage(convId, messageId, requesterId);

    const message = await this.messageRepository.findById(messageId);
    this.gateway.broadcastToRoom(convId, CHAT_MESSAGE_PINNED, message);
  }

  async unpinMessage(
    convId: string,
    messageId: string,
    requesterId: string,
  ): Promise<void> {
    const member = await this.conversationRepository.getMember(
      convId,
      requesterId,
    );
    if (!member) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    await this.messageRepository.unpinMessage(convId, messageId);

    this.gateway.broadcastToRoom(convId, CHAT_MESSAGE_UNPINNED, { messageId });
  }

  async getPinnedMessages(
    convId: string,
    userId: string,
  ): Promise<MessageResponse[]> {
    const member = await this.conversationRepository.getMember(convId, userId);
    if (!member) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    return this.messageRepository.findPinned(convId);
  }
}
