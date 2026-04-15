import { CursorPage } from '@common/types';
import { MediaResponse } from '@modules/media/interfaces/media-response.interface';
import {
  AvatarUrlsResponse,
  UserBasicInfoResponse,
} from '@modules/users/interfaces/user-response.interface';

export interface PostResponse extends UserBasicInfoResponse {
  id: string;
  avatarUrls: AvatarUrlsResponse;
  media: MediaResponse[];
  caption: string;
  visibility: string;
  createdAt: Date;
  isOwnPost: boolean;
  isOwnerViewedPost: boolean;
}

export type GetPostsResponse = CursorPage<PostResponse>;

export interface PostActivityResponse {
  postId: string;
  imageUrl: string;
  caption: string | null;
  senderAvatarUrl: string | null;
  unreadCount: number;
}
