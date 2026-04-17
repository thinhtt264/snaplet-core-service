import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';
import { ConversationService } from './conversation.service';
import { ChatGateway } from '../gateway/chat.gateway';
import { SocketService } from '@modules/socket/socket.service';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  MessageResponse,
  PaginatedMessages,
} from '../interfaces/message.response';
import {
  CHAT_CONVERSATION_UPDATED,
  CHAT_MESSAGE_DELETED,
  CHAT_MESSAGE_NEW,
  CHAT_MESSAGE_PINNED,
  CHAT_MESSAGE_UNPINNED,
} from '../events/chat-socket-events';
import {
  CHAT_MESSAGE_PAGE_SIZE,
  CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
} from '@common/constants/chat.constants';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly conversationService: ConversationService,
    private readonly gateway: ChatGateway,
    private readonly socketService: SocketService,
    private readonly cacheService: CacheService,
  ) {}

  async send(
    conversationId: string,
    dto: SendMessageDto,
    senderId: string,
  ): Promise<MessageResponse> {
    const message = await this.messageRepository.insertMessage({
      ...dto,
      conversationId,
      senderId,
    });

    if (dto.attachments?.length) {
      await this.messageRepository.insertAttachments(
        message.id,
        dto.attachments,
      );
    }

    await Promise.all([
      this.conversationService.updateLastMessageAt(
        conversationId,
        new Date(message.createdAt),
      ),
      // Write-through: keep last-message cache in sync so the conversation list
      // serves fresh data without a DB round-trip.
      this.cacheService.set(
        REDIS_KEY_FEATURES.CHAT_CONV_LAST_MESSAGE,
        conversationId,
        message,
        CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
      ),
    ]);

    this.gateway.broadcastToRoom(conversationId, CHAT_MESSAGE_NEW, message);

    const memberIds =
      await this.conversationService.getMemberUserIds(conversationId);
    for (const memberId of memberIds) {
      this.socketService.emitToUser(memberId, CHAT_CONVERSATION_UPDATED, {
        conversationId,
        lastMessage: message,
      });
    }

    return message;
  }

  async loadMessages(
    convId: string,
    userId: string,
    cursor?: string,
    limit: number = CHAT_MESSAGE_PAGE_SIZE,
  ): Promise<PaginatedMessages> {
    const isMember = await this.conversationService.isMember(convId, userId);
    if (!isMember) {
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
    const isMember = await this.conversationService.isMember(
      convId,
      requesterId,
    );
    if (!isMember) {
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
    const isMember = await this.conversationService.isMember(
      convId,
      requesterId,
    );
    if (!isMember) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    await this.messageRepository.unpinMessage(convId, messageId);

    this.gateway.broadcastToRoom(convId, CHAT_MESSAGE_UNPINNED, { messageId });
  }

  async getPinnedMessages(
    convId: string,
    userId: string,
  ): Promise<MessageResponse[]> {
    const isMember = await this.conversationService.isMember(convId, userId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    return this.messageRepository.findPinned(convId);
  }
}
