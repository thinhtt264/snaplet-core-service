import type { AuthResponse } from './auth-response.interface';

export interface GooglePayload {
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
}

export type GoogleSignInStatus =
  | 'existing_google'
  | 'merged_local'
  | 'new_user';

export interface GoogleSignInResponse extends AuthResponse {
  requiresOnboarding: boolean;
}
