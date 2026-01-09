import { Request } from 'express';
import { ClientFingerprint } from './fingerprint.types';

/**
 * Base Request interface for the entire application
 * Extends Express Request with common properties added by guards/middleware
 */
export interface BaseRequest extends Request {
  /**
   * Client fingerprint attached by FingerprintGuard
   * Always present (except for health check routes)
   */
  fingerprint: ClientFingerprint;

  /**
   * User information from decoded JWT payload (attached by JwtAuthGuard)
   * Present when user is authenticated
   * Structure matches JWT payload after validation in JwtStrategy
   */
  user?: {
    userId: string; // Required field from JWT payload
    iat?: number; // Issued at timestamp from JWT
    [key: string]: any; // Other fields from JWT payload
  };

  /**
   * Device registration Redis key attached by DeviceDailyLimitGuard
   * Used for cleanup on error
   */
  deviceRegistrationRedisKey?: string;
}
