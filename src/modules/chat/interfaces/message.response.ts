import { CursorPage } from '@common/types';
import { ImageSizesResponse } from '@common/types/image-sizes.types';

export interface MessageReactionResponse {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  clientUuid: string;
  text: string | null;
  media: {
    urls: ImageSizesResponse;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    status: 'AVAILABLE' | 'SOURCE_DELETED';
  } | null;
  isDeleted: boolean;
  replyTo: {
    id: string;
    senderId: string;
    text: string | null;
    isDeleted: boolean;
  } | null;
  pinnedAt: Date | null;
  createdAt: Date;
  reactions: MessageReactionResponse[];
}

export type PaginatedMessages = CursorPage<MessageResponse>;
