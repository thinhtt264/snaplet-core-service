import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageRepository } from '../repositories/message.repository';
import { ConversationService } from './conversation.service';
import { ChatGateway } from '../gateway/chat.gateway';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  MessageReactionRecordResponse,
  MessageReactionResponse,
  MessageResponse,
  PaginatedMessages,
} from '../interfaces/message.response';
import {
  CHAT_MESSAGE_DELETED,
  CHAT_MESSAGE_NEW,
  CHAT_MESSAGE_PINNED,
  CHAT_MESSAGE_REACTION_UPDATED,
  CHAT_MESSAGE_UNPINNED,
  ChatMessageReactionUpdatedEventPayload,
} from '../events/chat-socket-events';
import {
  CHAT_MESSAGE_PAGE_SIZE,
  CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
} from '@common/constants/chat.constants';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import { ReadReceiptService } from './read-receipt.service';
import { normalizeImageV1MediaKey } from '@common/utils/media-key.utils';
import { MessageReactionRepository } from '../repositories/message-reaction.repository';
import { UserService } from '@modules/users/services/user.service';
import {
  CHAT_MESSAGE_REACTED_EVENT,
  CHAT_MESSAGE_SENT_EVENT,
  ChatMessageReactedEvent,
  ChatMessageSentEvent,
} from '../events/chat-notification.events';

type ReactionUserBasic = MessageReactionResponse['user'];
type CachedMessageReaction = Omit<
  MessageReactionRecordResponse,
  'createdAt'
> & {
  createdAt: string;
};

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly conversationService: ConversationService,
    private readonly readReceiptService: ReadReceiptService,
    private readonly messageReactionRepository: MessageReactionRepository,
    private readonly userService: UserService,
    private readonly gateway: ChatGateway,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
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

    if (recipientId !== senderId) {
      const evt = new ChatMessageSentEvent();
      evt.recipientUserId = recipientId;
      evt.conversationId = message.conversationId;
      evt.messageId = message.id;
      evt.senderUserId = senderId;
      evt.text = message.text ?? null;
      evt.hasImage = message.media?.status === 'AVAILABLE';
      this.eventEmitter.emit(CHAT_MESSAGE_SENT_EVENT, evt);
    }

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

    const result = await this.messageRepository.findByConversation(
      convId,
      cursor,
      limit,
    );
    const messageIds = result.data.map((message) => message.id);
    const reactionRecordsByMessageId =
      await this.messageReactionRepository.findByMessageIds(messageIds);
    result.data = result.data.map((message) => ({
      ...message,
      reactions: reactionRecordsByMessageId.get(message.id) ?? [],
    }));
    return result;
  }

  async reactToMessage(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageReactionRecordResponse[]> {
    const normalizedEmoji = this.normalizeReactionEmoji(emoji);
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const isMember = await this.conversationService.isMember(
      message.conversationId,
      userId,
    );
    if (!isMember) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    const { actorEmoji, reactions } =
      await this.messageReactionRepository.upsertToggle(
        messageId,
        userId,
        normalizedEmoji,
      );
    await this.cacheService.set(
      REDIS_KEY_FEATURES.CHAT_MESSAGE_REACTIONS,
      messageId,
      reactions,
      CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
    );

    const payload: ChatMessageReactionUpdatedEventPayload = {
      conversationId: message.conversationId,
      messageId,
      actorId: userId,
      actorEmoji,
      reactions,
    };
    this.gateway.broadcastToRoom(
      message.conversationId,
      CHAT_MESSAGE_REACTION_UPDATED,
      payload,
    );

    if (message.senderId !== userId) {
      const evt = new ChatMessageReactedEvent();
      evt.recipientUserId = message.senderId;
      evt.conversationId = message.conversationId;
      evt.messageId = messageId;
      evt.reactorUserId = userId;
      evt.emoji = normalizedEmoji;
      this.eventEmitter.emit(CHAT_MESSAGE_REACTED_EVENT, evt);
    }

    return reactions;
  }

  async getMessageReactions(
    messageId: string,
    userId: string,
  ): Promise<MessageReactionResponse[]> {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const isMember = await this.conversationService.isMember(
      message.conversationId,
      userId,
    );
    if (!isMember) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    const reactionRecords = await this.getCachedMessageReactions(messageId);
    return this.enrichReactionRecords(reactionRecords);
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
    void this.cacheService
      .invalidate(REDIS_KEY_FEATURES.CHAT_MESSAGE_REACTIONS, messageId)
      .catch(() => undefined);

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

  private async getCachedMessageReactions(
    messageId: string,
  ): Promise<MessageReactionRecordResponse[]> {
    return this.cacheService.getOrCompute<MessageReactionRecordResponse[]>(
      REDIS_KEY_FEATURES.CHAT_MESSAGE_REACTIONS,
      messageId,
      () => this.messageReactionRepository.findByMessageId(messageId),
      CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
      {
        deserialize: (raw) => this.deserializeCachedReactions(raw),
      },
    );
  }

  private async enrichReactionRecords(
    records: MessageReactionRecordResponse[],
  ): Promise<MessageReactionResponse[]> {
    const defaultUserBasic: ReactionUserBasic = {
      userId: '',
      username: '',
      firstName: '',
      lastName: '',
      avatarUrls: this.userService.getAvatarUrlsForKey(null),
    };
    const userIds = [...new Set(records.map((record) => record.userId))];
    const userMap = await this.userService.getUserBasicInfoMapByIds(userIds);

    return records.map((record) => {
      const user = userMap.get(record.userId) ?? defaultUserBasic;
      return {
        ...record,
        user,
      };
    });
  }

  private deserializeCachedReactions(
    raw: string,
  ): MessageReactionRecordResponse[] {
    const parsed = JSON.parse(raw) as CachedMessageReaction[];
    return parsed.map((item) => ({
      id: item.id,
      messageId: item.messageId,
      userId: item.userId,
      emoji: item.emoji,
      createdAt: new Date(item.createdAt),
    }));
  }

  private normalizeReactionEmoji(emoji: string): string {
    return emoji
      .trim()
      .normalize('NFC')
      .replace(/\uFE0F/g, '');
  }
}
