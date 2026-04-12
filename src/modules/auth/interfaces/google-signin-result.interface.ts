import type { AuthResponse } from './auth-response.interface';

export interface GooglePayload {
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
}

export interface GoogleSignInResponse extends AuthResponse {
  requiresOnboarding: boolean;
}
