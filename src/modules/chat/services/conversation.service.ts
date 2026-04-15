import { Injectable, Logger } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { UnreadCountService } from './unread-count.service';
import { UserService } from '@modules/users/services/user.service';
import { UserRepository } from '@modules/users/repositories/user.repository';
import {
  ConversationResponse,
  PaginatedConversations,
} from '../interfaces/conversation.response';
import { MessageRepository } from '../repositories/message.repository';
import { ImageSizeKey } from '@common/types';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly unreadCountService: UnreadCountService,
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
  ) {}

  async findOrCreateDirect(
    userA: string,
    userB: string,
  ): Promise<{ id: string; isNew: boolean }> {
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
    this.logger.debug(`[getConversationList] rows=${rows.length}`);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const convIds = page.map((row) => row.conversation.id);

    // Single query to get all partner userIds
    const partnerIdMap =
      await this.conversationRepository.getPartnerUserIdsBatch(convIds, userId);
    this.logger.debug(
      `[getConversationList] partnerIdMap size=${partnerIdMap.size}`,
    );
    const uniquePartnerIds = [...new Set(partnerIdMap.values())];

    // Bulk fetch partner user info
    const partnerUsers =
      await this.userRepository.findManyByIds(uniquePartnerIds);
    this.logger.debug(
      `[getConversationList] partnerUsers=${partnerUsers.length}`,
    );
    const partnerMap = new Map(partnerUsers.map((u) => [u._id.toString(), u]));

    // Batch fetch has-unread flags + last messages in parallel — eliminates N+1 queries.
    const [hasUnreadMap, lastMessageMap] = await Promise.all([
      this.unreadCountService.getHasUnreadBatch(convIds, userId),
      this.messageRepository.findLastMessagesBatch(convIds),
    ]);
    this.logger.debug(
      `[getConversationList] hasUnreadMap size=${hasUnreadMap.size}, lastMessageMap size=${lastMessageMap.size}`,
    );

    const data = page.map((row) => {
      const { conversation } = row;
      const partnerId = partnerIdMap.get(conversation.id) ?? null;
      const partnerUser = partnerId ? partnerMap.get(partnerId) : null;

      const avatarUrls = partnerUser
        ? this.userService.getAvatarUrlsForKey(partnerUser.avatarKey, {
            sizes: [ImageSizeKey.SM],
          })
        : null;

      const hasUnread = hasUnreadMap.get(conversation.id) ?? false;
      const lastMessage = conversation.lastMessageAt
        ? (lastMessageMap.get(conversation.id) ?? null)
        : null;

      return {
        id: conversation.id,
        partner: partnerUser
          ? {
              id: partnerUser._id.toString(),
              username: partnerUser.username ?? '',
              displayName:
                `${partnerUser.firstName ?? ''} ${partnerUser.lastName ?? ''}`.trim(),
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
