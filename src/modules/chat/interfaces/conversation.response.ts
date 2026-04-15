import { CursorPage } from '@common/types';
import { MessageResponse } from './message.response';

export interface PartnerInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ConversationResponse {
  id: string;
  partner: PartnerInfo;
  lastMessage: MessageResponse | null;
  hasUnread: boolean;
  lastMessageAt: string | null;
  createdAt: string;
}

export type PaginatedConversations = CursorPage<ConversationResponse>;
