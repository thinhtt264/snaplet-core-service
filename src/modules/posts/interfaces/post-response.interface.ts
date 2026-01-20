import { UserBasicInfoResponse } from '@modules/users/interfaces/user-response.interface';

export interface MediaItem {
  id: string;
  type: string;
  originalUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface PostResponse extends UserBasicInfoResponse {
  id: string;
  media: MediaItem[];
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
