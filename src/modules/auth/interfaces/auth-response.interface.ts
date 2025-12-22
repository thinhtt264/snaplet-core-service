export interface AuthResponse {
  token: TokenResponse;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  };
}
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}
