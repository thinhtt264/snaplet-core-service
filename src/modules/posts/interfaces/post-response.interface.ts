import { CursorPagination } from '@common/types';
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
}

export interface GetPostsResponse {
  data: PostResponse[];
  pagination: CursorPagination;
}
