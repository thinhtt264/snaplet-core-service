import type { AvatarUrlsResponse } from '@common/types';

export interface AuthResponse {
  token: TokenResponse;
  user: {
    id: string;
    email: string;
    username: string | null;
    firstName: string;
    lastName: string;
    avatarUrls: AvatarUrlsResponse;
  };
}
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}
