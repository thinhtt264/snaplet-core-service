import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { UnreadCountService } from './unread-count.service';
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

interface CachedPartnerProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarKey: string | null;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly unreadCountService: UnreadCountService,
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
    private readonly cacheService: CacheService,
  ) {}

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

    let existing: Awaited<
      ReturnType<typeof this.conversationRepository.findDirectBetween>
    >;
    try {
      existing = await this.conversationRepository.findDirectBetween(
        userA,
        userB,
      );
    } catch (err) {
      this.logger.error(`[findOrCreateDirect] findDirectBetween FAILED`, err);
      throw err;
    }

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    let created: Awaited<ReturnType<typeof this.conversationRepository.create>>;
    try {
      created = await this.conversationRepository.create(userA, userB);
    } catch (err) {
      this.logger.error(`[findOrCreateDirect] create FAILED`, err);
      throw err;
    }

    return { id: created.id, isNew: true };
  }

  async updateLastMessageAt(convId: string, timestamp: Date): Promise<void> {
    await this.conversationRepository.updateLastMessageAt(convId, timestamp);
  }

  async isMember(convId: string, userId: string): Promise<boolean> {
    return this.cacheService.getOrCompute(
      REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
      `${convId}:${userId}`,
      async () => {
        const member = await this.conversationRepository.getMember(
          convId,
          userId,
        );
        return !!member;
      },
      CHAT_CONVERSATION_MEMBER_CACHE_TTL_SECONDS,
      { shouldCache: (value) => value === true },
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

    await this.conversationRepository.delete(convId);

    await Promise.all(
      memberUserIds.map((userId) =>
        this.cacheService.invalidate(
          REDIS_KEY_FEATURES.CHAT_CONVERSATION_MEMBER,
          `${convId}:${userId}`,
        ),
      ),
    );
  }

  async getConversationList(
    userId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<PaginatedConversations> {
    this.logger.debug(`[getConversationList] userId=${userId}`);

    const parsed = cursor ? this.decodeCursor(cursor) : undefined;
    const rows = await this.conversationRepository.findAllByUserId(
      userId,
      parsed,
      limit,
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const convIds = page.map((row) => row.conversation.id);

    const partnerIdMap =
      await this.conversationRepository.getPartnerUserIdsBatch(convIds, userId);
    this.logger.debug(
      `[getConversationList] partnerIdMap size=${partnerIdMap.size}`,
    );
    const uniquePartnerIds = [...new Set(partnerIdMap.values())];

    // Resolve partner profiles, last messages, and unread flags in parallel.
    // mgetOrCompute issues a single MGET + single pipeline MSET per group,
    // with one batched DB call for all misses.
    const [partnerMap, lastMessageMap, hasUnreadMap] = await Promise.all([
      // Partner profiles: MGET → batch MongoDB fetch for misses → pipeline MSET.
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

      // Last messages: MGET → batch DB fetch for misses → pipeline MSET.
      this.cacheService.mgetOrCompute<MessageResponse>(
        REDIS_KEY_FEATURES.CHAT_CONV_LAST_MESSAGE,
        convIds,
        (missConvIds) =>
          this.messageRepository.findLastMessagesBatch(missConvIds),
        CONV_LAST_MESSAGE_CACHE_TTL_SECONDS,
      ),

      this.unreadCountService.getHasUnreadBatch(convIds, userId),
    ]);

    this.logger.debug(
      `[getConversationList] hasUnreadMap size=${hasUnreadMap.size}, lastMessageMap size=${lastMessageMap.size}`,
    );

    const data = page.map((row) => {
      const { conversation } = row;
      const partnerId = partnerIdMap.get(conversation.id) ?? null;
      const partnerProfile = partnerId ? partnerMap.get(partnerId) : null;

      const avatarUrls = partnerProfile?.avatarKey
        ? this.userService.getAvatarUrlsForKey(partnerProfile.avatarKey, {
            sizes: [ImageSizeKey.SM],
          })
        : null;

      const hasUnread = hasUnreadMap.get(conversation.id) ?? false;
      const lastMessage = conversation.lastMessageAt
        ? (lastMessageMap.get(conversation.id) ?? null)
        : null;

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
        hasUnread,
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        createdAt: conversation.createdAt.toISOString(),
      } satisfies ConversationResponse;
    });

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeCursor(
            last.conversation.lastMessageAt,
            last.conversation.id,
          )
        : null;

    return { data, pagination: { limit, nextCursor } };
  }

  private encodeCursor(lastMessageAt: Date | null, id: string): string {
    return Buffer.from(`${lastMessageAt?.getTime() ?? 'null'}_${id}`).toString(
      'base64',
    );
  }

  private decodeCursor(cursor: string): {
    lastMessageAt: Date | null;
    id: string;
  } {
    try {
      const [ts, id] = Buffer.from(cursor, 'base64').toString().split('_');
      return {
        lastMessageAt: ts === 'null' ? null : new Date(Number(ts)),
        id,
      };
    } catch {
      return { lastMessageAt: null, id: '' };
    }
  }
}
