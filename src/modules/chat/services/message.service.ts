import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';
import { ConversationService } from './conversation.service';
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
import {
  CHAT_MESSAGE_PAGE_SIZE,
  CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
} from '@common/constants/chat.constants';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { ReadReceiptService } from './read-receipt.service';
import { normalizeImageV1MediaKey } from '@common/utils/media-key.utils';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly conversationService: ConversationService,
    private readonly readReceiptService: ReadReceiptService,
    private readonly gateway: ChatGateway,
    private readonly cacheService: CacheService,
  ) {}

  async send(dto: SendMessageDto, senderId: string): Promise<MessageResponse> {
    const {
      text,
      clientUuid,
      recipientId,
      mediaKey,
      mediaUrl,
      mimeType,
      replyToId,
      width,
      height,
    } = dto;

    if (text == null && mediaKey == null && mediaUrl == null) {
      throw new BadRequestException(
        'Message must have at least text, mediaKey, or mediaUrl',
      );
    }

    const normalizedMediaKey = normalizeImageV1MediaKey(mediaKey);

    const { id: conversationId } =
      await this.conversationService.findOrCreateDirect(senderId, recipientId);

    const message = await this.messageRepository.insertMessage({
      conversationId,
      senderId,
      clientUuid,
      text,
      mediaKey: normalizedMediaKey,
      mediaUrl,
      mimeType: mimeType ?? null,
      width: width ?? null,
      height: height ?? null,
      replyToId,
    });

    await Promise.all([
      this.conversationService.updateLastMessageAt(
        conversationId,
        new Date(message.createdAt),
      ),
      this.cacheService.set(
        REDIS_KEY_FEATURES.CHAT_CONV_LAST_MESSAGE,
        conversationId,
        message,
        CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
      ),
    ]);

    this.gateway.broadcastToRoom(conversationId, CHAT_MESSAGE_NEW, message);

    void this.conversationService.notifyConversationUpdated(
      conversationId,
      senderId,
      message.text ?? '',
      new Date(message.createdAt),
    );

    return message;
  }

  async markMessageSeen(
    convId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    const isMember = await this.conversationService.isMember(convId, userId);
    if (!isMember)
      throw new ForbiddenException('Not a member of this conversation');
    await this.readReceiptService.markRead(convId, userId, messageId);
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

  async hardDeleteMessage(
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

    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.messageRepository.hardDelete(messageId, requesterId);

    this.gateway.broadcastToRoom(convId, CHAT_MESSAGE_DELETED, { messageId });
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
