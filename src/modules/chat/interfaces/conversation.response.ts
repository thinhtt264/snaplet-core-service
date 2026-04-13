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
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}
