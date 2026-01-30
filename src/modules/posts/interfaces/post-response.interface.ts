import { MediaResponse } from '@modules/media/interfaces/media-response.interface';
import { UserBasicInfoResponse } from '@modules/users/interfaces/user-response.interface';

export interface PostResponse extends UserBasicInfoResponse {
  id: string;
  media: MediaResponse[];
  caption: string;
  visibility: string;
  createdAt: Date;
  isOwnPost: boolean;
}

export interface GetPostsResponse {
  data: PostResponse[];
  pagination: {
    limit: number;
    hasNext: boolean;
    nextCursor?: string; // base64 encoded cursor
  };
}
