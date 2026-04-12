import type { AvatarUrlsResponse, ImageSizesResponse } from '@common/types';

export type { AvatarUrlsResponse, ImageSizesResponse };

export interface IUserProfileResponse {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarUrls: AvatarUrlsResponse;
  createdAt: Date;
}

export interface UserBasicInfoResponse {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrls: AvatarUrlsResponse;
}

export interface AvatarUploadRequestResponse {
  uploadUrl: string;
  key: string;
  maxSizeBytes: number;
}
