import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { UserService } from '@modules/users/services/user.service';
import { UserRepository } from '@modules/users/repositories/user.repository';
import {
  ConversationResponse,
  PaginatedConversations,
} from '../interfaces/conversation.response';
import { MessageRepository } from '../repositories/message.repository';
import { MessageResponse } from '../interfaces/message.response';
import { ImageSizeKey } from '@common/types';
import { CacheService } from '@modules/cache/cache.service';
import { REDIS_KEY_FEATURES } from '@common/constants/redis-keys.constants';
import {
  CHAT_CONVERSATION_MEMBER_CACHE_TTL_SECONDS,
  CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
  PARTNER_PROFILE_CACHE_TTL_SECONDS,
} from '@common/constants/chat.constants';
import { RelationshipService } from '@modules/relationships/services/relationship.service';
import { RelationshipStatus } from '@modules/relationships/schemas/relationship.schema';
import { SocketService } from '@modules/socket/socket.service';
import {
  CONVERSATION_DELETED,
  CONVERSATION_UPDATED,
  ConversationUpdatedPayload,
} from '@modules/socket/events/socket-events';

interface CachedPartnerProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarKey: string | null;
}

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
    private readonly cacheService: CacheService,
    private readonly relationshipService: RelationshipService,
    private readonly socketService: SocketService,
  ) {}

  async notifyConversationUpdated(
    convId: string,
    senderId: string,
    lastMessageText: string,
    lastMessageAt: Date,
  ): Promise<void> {
    const memberIds = await this.getMemberUserIds(convId);
    const payload: ConversationUpdatedPayload = {
      conversationId: convId,
      lastMessageText,
      lastMessageAt,
      lastMessageSenderId: senderId,
    };
    for (const memberId of memberIds) {
      if (memberId === senderId) continue;
      this.socketService.emitToUser(memberId, CONVERSATION_UPDATED, payload);
    }
  }

  async findOrCreateDirect(
    userA: string,
    userB: string,
  ): Promise<{ id: string; isNew: boolean }> {
    if (userA === userB) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    const recipient = await this.userRepository.findActiveById(userB);
    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }

    const relationship = await this.relationshipService.getRelationshipWithUser(
      userA,
      userB,
    );
    if (relationship?.status !== RelationshipStatus.ACCEPTED) {
      throw new ForbiddenException(
        'You can only message users who are your friends',
      );
    }

    const { conversation, isNew } =
      await this.conversationRepository.findOrCreate(userA, userB);

    if (isNew) {
      // Invalidate member cache so isMember picks up the new conversation
      await Promise.all([
        this.cacheService.invalidate(
          REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
          `${conversation.id}:${userA}`,
        ),
        this.cacheService.invalidate(
          REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
          `${conversation.id}:${userB}`,
        ),
        this.cacheService.invalidate(
          REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
          `${conversation.id}:members`,
        ),
      ]);
    }

    return { id: conversation.id, isNew };
  }

  async updateLastMessageAt(convId: string, timestamp: Date): Promise<void> {
    await this.conversationRepository.updateLastMessageAt(convId, timestamp);
  }

  async isMember(convId: string, userId: string): Promise<boolean> {
    return this.cacheService.getOrCompute(
      REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
      `${convId}:${userId}`,
      () => this.conversationRepository.isMember(convId, userId),
      CHAT_CONVERSATION_MEMBER_CACHE_TTL_SECONDS,
    );
  }

  async getMemberUserIds(convId: string): Promise<string[]> {
    return this.cacheService.getOrCompute(
      REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
      `${convId}:members`,
      () => this.conversationRepository.getMemberUserIds(convId),
      CHAT_CONVERSATION_MEMBER_CACHE_TTL_SECONDS,
    );
  }

  async deleteConversation(convId: string): Promise<void> {
    const memberUserIds =
      await this.conversationRepository.getMemberUserIds(convId);

    for (const userId of memberUserIds) {
      this.socketService.emitToUser(userId, CONVERSATION_DELETED, {
        conversationId: convId,
      });
    }

    await this.conversationRepository.delete(convId);

    await Promise.all([
      ...memberUserIds.map((userId) =>
        this.cacheService.invalidate(
          REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
          `${convId}:${userId}`,
        ),
      ),
      this.cacheService.invalidate(
        REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
        `${convId}:members`,
      ),
    ]);
  }

  async getConversationList(
    userId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<PaginatedConversations> {
    const parsed = cursor ? this.decodeCursor(cursor) : undefined;
    const rows = await this.conversationRepository.findAllByUserId(
      userId,
      parsed,
      limit,
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const convIds = page.map((conv) => conv.id);

    // Partner IDs are embedded in the conversation rows — no extra batch query needed
    const partnerIdMap = new Map(
      page.map((conv) => [
        conv.id,
        conv.userA === userId ? conv.userB : conv.userA,
      ]),
    );
    const uniquePartnerIds = [...new Set(partnerIdMap.values())];

    const [
      partnerMap,
      lastMessageMap,
      { myLastReadAtMap, partnerLastReadAtMap },
    ] = await Promise.all([
      this.cacheService.mgetOrCompute<CachedPartnerProfile>(
        REDIS_KEY_FEATURES.CHAT_PARTNER_PROFILE,
        uniquePartnerIds,
        async (missIds) => {
          const users = await this.userRepository.findManyByIds(missIds);
          return new Map(
            users.map((u) => [
              u._id.toString(),
              {
                id: u._id.toString(),
                username: u.username ?? null,
                firstName: u.firstName ?? null,
                lastName: u.lastName ?? null,
                avatarKey: u.avatarKey ?? null,
              },
            ]),
          );
        },
        PARTNER_PROFILE_CACHE_TTL_SECONDS,
      ),

      this.cacheService.mgetOrCompute<MessageResponse>(
        REDIS_KEY_FEATURES.CHAT_CONV_LAST_MESSAGE,
        convIds,
        (missConvIds) =>
          this.messageRepository.findLastMessagesBatch(missConvIds),
        CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
      ),

      this.conversationRepository.getBothReadAtBatch(convIds, userId),
    ]);

    const data = page.map((conv) => {
      const partnerId = partnerIdMap.get(conv.id) ?? null;
      const partnerProfile = partnerId ? partnerMap.get(partnerId) : null;
      const myLastReadAt = myLastReadAtMap.get(conv.id) ?? null;
      const partnerLastReadAt = partnerLastReadAtMap.get(conv.id) ?? null;
      const lastMessage = conv.lastMessageAt
        ? (lastMessageMap.get(conv.id) ?? null)
        : null;

      return this.mapToConversationResponse(
        conv,
        partnerId,
        partnerProfile ?? null,
        lastMessage,
        myLastReadAt,
        partnerLastReadAt,
      );
    });

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? this.encodeCursor(last.lastMessageAt, last.id) : null;

    return { data, pagination: { limit, nextCursor } };
  }

  async getConversationById(
    convId: string,
    userId: string,
  ): Promise<ConversationResponse> {
    const conversation = await this.conversationRepository.findById(convId);
    if (
      !conversation ||
      (conversation.userA !== userId && conversation.userB !== userId)
    ) {
      throw new NotFoundException('Conversation not found');
    }

    const partnerId =
      conversation.userA === userId ? conversation.userB : conversation.userA;

    const [
      partnerMap,
      lastMessageMap,
      { myLastReadAtMap, partnerLastReadAtMap },
    ] = await Promise.all([
      this.cacheService.mgetOrCompute<CachedPartnerProfile>(
        REDIS_KEY_FEATURES.CHAT_PARTNER_PROFILE,
        [partnerId],
        async (missIds) => {
          const users = await this.userRepository.findManyByIds(missIds);
          return new Map(
            users.map((u) => [
              u._id.toString(),
              {
                id: u._id.toString(),
                username: u.username ?? null,
                firstName: u.firstName ?? null,
                lastName: u.lastName ?? null,
                avatarKey: u.avatarKey ?? null,
              },
            ]),
          );
        },
        PARTNER_PROFILE_CACHE_TTL_SECONDS,
      ),
      this.cacheService.mgetOrCompute<MessageResponse>(
        REDIS_KEY_FEATURES.CHAT_CONV_LAST_MESSAGE,
        [convId],
        (missConvIds) =>
          this.messageRepository.findLastMessagesBatch(missConvIds),
        CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
      ),
      this.conversationRepository.getBothReadAtBatch([convId], userId),
    ]);

    const partnerProfile = partnerMap.get(partnerId) ?? null;
    const myLastReadAt = myLastReadAtMap.get(convId) ?? null;
    const partnerLastReadAt = partnerLastReadAtMap.get(convId) ?? null;
    const lastMessage = conversation.lastMessageAt
      ? (lastMessageMap.get(convId) ?? null)
      : null;

    return this.mapToConversationResponse(
      conversation,
      partnerId,
      partnerProfile,
      lastMessage,
      myLastReadAt,
      partnerLastReadAt,
    );
  }

  private mapToConversationResponse(
    conversation: { id: string; createdAt: Date; lastMessageAt: Date | null },
    partnerId: string | null,
    partnerProfile: CachedPartnerProfile | null,
    lastMessage: MessageResponse | null,
    myLastReadAt: Date | null,
    partnerLastReadAt: Date | null,
  ): ConversationResponse {
    const avatarUrls = partnerProfile?.avatarKey
      ? this.userService.getAvatarUrlsForKey(partnerProfile.avatarKey, {
          sizes: [ImageSizeKey.SM],
        })
      : null;

    const myLastSeenAt = myLastReadAt?.getTime() ?? null;
    const partnerLastSeenAt = partnerLastReadAt?.getTime() ?? null;

    const candidates = [
      conversation.lastMessageAt?.getTime() ?? null,
      myLastSeenAt,
      partnerLastSeenAt,
    ].filter((t): t is number => t !== null);
    const updatedAt =
      candidates.length > 0
        ? Math.max(...candidates)
        : conversation.createdAt.getTime();

    return {
      id: conversation.id,
      partner: partnerProfile
        ? {
            id: partnerProfile.id,
            username: partnerProfile.username ?? '',
            displayName:
              `${partnerProfile.firstName ?? ''} ${partnerProfile.lastName ?? ''}`.trim(),
            avatarUrl: avatarUrls?.sm || null,
          }
        : {
            id: partnerId ?? '',
            username: '',
            displayName: '',
            avatarUrl: null,
          },
      lastMessage,
      myLastSeenAt,
      partnerLastSeenAt,
      updatedAt: new Date(updatedAt),
      createdAt: conversation.createdAt,
    };
  }

  private encodeCursor(lastMessageAt: Date | null, id: string): string {
    return Buffer.from(`${lastMessageAt?.getTime() ?? 'null'}_${id}`).toString(
      'base64',
    );
  }

  private decodeCursor(
    cursor: string,
  ): { lastMessageAt: Date | null; id: string } | undefined {
    try {
      const [ts, id] = Buffer.from(cursor, 'base64').toString().split('_');
      if (!id) return undefined;
      return {
        lastMessageAt: ts === 'null' ? null : new Date(Number(ts)),
        id,
      };
    } catch {
      return undefined;
    }
  }
}
