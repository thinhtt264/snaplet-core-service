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
  myLastSeenAt: Date | null;
  partnerLastSeenAt: Date | null;
  syncUpdatedAt: Date;
  createdAt: Date;
}

export type PaginatedConversations = CursorPage<ConversationResponse>;
