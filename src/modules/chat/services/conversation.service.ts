import { Injectable } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { UnreadCountService } from './unread-count.service';
import { UserService } from '@modules/users/services/user.service';
import { UserRepository } from '@modules/users/repositories/user.repository';
import { ConversationResponse } from '../interfaces/conversation.response';
import { MessageRepository } from '../repositories/message.repository';
import { ImageSizeKey } from '@common/types';

@Injectable()
export class ConversationService {
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
    const existing = await this.conversationRepository.findDirectBetween(
      userA,
      userB,
    );

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    const created = await this.conversationRepository.create(userA, userB);
    return { id: created.id, isNew: true };
  }

  async getConversationList(userId: string): Promise<ConversationResponse[]> {
    const rows = await this.conversationRepository.findAllByUserId(userId);

    const convIds = rows.map((row) => row.conversation.id);

    // Single query to get all partner userIds
    const partnerIdMap =
      await this.conversationRepository.getPartnerUserIdsBatch(convIds, userId);
    const uniquePartnerIds = [...new Set(partnerIdMap.values())];

    // Bulk fetch partner user info
    const partnerUsers =
      await this.userRepository.findManyByIds(uniquePartnerIds);
    const partnerMap = new Map(partnerUsers.map((u) => [u._id.toString(), u]));

    // Batch fetch unread counts + last messages in parallel — eliminates N+1 queries.
    const [unreadCountMap, lastMessageMap] = await Promise.all([
      this.unreadCountService.getCountsBatch(convIds, userId),
      this.messageRepository.findLastMessagesBatch(convIds),
    ]);

    return rows.map((row) => {
      const { conversation } = row;
      const partnerId = partnerIdMap.get(conversation.id) ?? null;
      const partnerUser = partnerId ? partnerMap.get(partnerId) : null;

      const avatarUrls = partnerUser
        ? this.userService.getAvatarUrlsForKey(partnerUser.avatarKey, {
            sizes: [ImageSizeKey.SM],
          })
        : null;

      const unreadCount = unreadCountMap.get(conversation.id) ?? 0;
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
        unreadCount,
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        createdAt: conversation.createdAt.toISOString(),
      } satisfies ConversationResponse;
    });
  }
}
