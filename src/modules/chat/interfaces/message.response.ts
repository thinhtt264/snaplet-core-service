import { CursorPage } from '@common/types';
import { MessageType } from '../dto/send-message.dto';

export interface AttachmentResponse {
  id: string;
  mediaKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  clientUuid: string;
  type: MessageType;
  content: string | null;
  isDeleted: boolean;
  replyTo: {
    id: string;
    senderId: string;
    content: string | null;
    isDeleted: boolean;
  } | null;
  attachments: AttachmentResponse[];
  pinnedAt: string | null;
  createdAt: string;
}

export type PaginatedMessages = CursorPage<MessageResponse>;
