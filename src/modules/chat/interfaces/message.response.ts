import { CursorPage } from '@common/types';
import { ImageSizesResponse } from '@common/types/image-sizes.types';
import { UserBasicInfoResponse } from '@modules/users/interfaces/user-response.interface';

export interface MessageReactionRecordResponse {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface MessageReactionResponse extends MessageReactionRecordResponse {
  user: UserBasicInfoResponse;
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
  reactions: MessageReactionRecordResponse[];
}

export type PaginatedMessages = CursorPage<MessageResponse>;
