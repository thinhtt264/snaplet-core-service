/**
 * Redis utility functions
 */

import {
  RedisKeyFeature,
  REDIS_KEY_FEATURES,
} from '../constants/redis-keys.constants';

/**
 * Get date key in format YYYY-MM-DD (UTC)
 * Used for generating consistent date-based Redis keys
 */
export function getDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format: snaplet:{env}:{cacheVersion}:{feature}:{YYYY-MM-DD-HH-MM}
 *
 * @param feature - Redis key feature from REDIS_KEY_FEATURES
 * @returns Redis key string
 */
export function buildRedisKey(
  feature: RedisKeyFeature,
  extraValue?: string,
): string {
  const env = process.env.NODE_ENV || 'development';
  const cacheVersion = process.env.REDIS_CACHE_VERSION || 'v1';
  return `snaplet:${env}:${cacheVersion}:${feature}${extraValue ? `:${extraValue}` : ''}`;
}

/** Redis key for a user's refresh token (one per user). */
export function refreshTokenKey(userId: string): string {
  return `${REDIS_KEY_FEATURES.REFRESH_TOKEN}:${userId}`;
}

/**
 * Redis key for a user's active auth session (access-token validity).
 * Stored value: JSON stringified { authSessionId, deviceId }.
 *
 * One active session per user.
 */
export function authActiveSessionKey(userId: string): string {
  return `${REDIS_KEY_FEATURES.AUTH_ACTIVE_SESSION}:${userId}`;
}
