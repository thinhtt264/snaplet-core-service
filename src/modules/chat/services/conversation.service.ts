import { Injectable } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { UnreadCountService } from './unread-count.service';
import { UserService } from '@modules/users/services/user.service';
import { UserRepository } from '@modules/users/repositories/user.repository';
import { ConversationResponse } from '../interfaces/conversation.response';
import { MessageResponse } from '../interfaces/message.response';
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

    // Collect all partner userIds for bulk fetch
    const partnerIdPromises = rows.map((row) =>
      this.conversationRepository.getPartnerUserId(row.conversation.id, userId),
    );
    const partnerIds = await Promise.all(partnerIdPromises);
    const uniquePartnerIds = [
      ...new Set(partnerIds.filter(Boolean)),
    ] as string[];

    // Bulk fetch partner user info
    const partnerUsers =
      await this.userRepository.findManyByIds(uniquePartnerIds);
    const partnerMap = new Map(partnerUsers.map((u) => [u._id.toString(), u]));

    const results = await Promise.all(
      rows.map(async (row, idx) => {
        const { conversation } = row;
        const partnerId = partnerIds[idx];
        const partnerUser = partnerId ? partnerMap.get(partnerId) : null;

        const avatarUrls = partnerUser
          ? this.userService.getAvatarUrlsForKey(partnerUser.avatarKey, {
              sizes: [ImageSizeKey.SM],
            })
          : null;

        const unreadCount = await this.unreadCountService.getCount(
          conversation.id,
          userId,
        );

        // Fetch last message if any
        let lastMessage: MessageResponse | null = null;
        if (conversation.lastMessageAt) {
          const paginated = await this.messageRepository.findByConversation(
            conversation.id,
            undefined,
            1,
          );
          lastMessage = paginated.data[0] ?? null;
        }

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
      }),
    );

    return results;
  }
}
