/**
 * Redis Key Feature Constants
 * Centralized constants for all Redis key features
 */
export const REDIS_KEY_FEATURES = {
  DEVICE_REGISTRATION: 'device-registration',
  USER_NOT_FOUND: 'user-not-found',
  // Add more features here as needed
  // USER_SESSION: 'user-session',
  // RATE_LIMIT: 'rate-limit',
  // CACHE: 'cache',
} as const;

export type RedisKeyFeature =
  (typeof REDIS_KEY_FEATURES)[keyof typeof REDIS_KEY_FEATURES];
