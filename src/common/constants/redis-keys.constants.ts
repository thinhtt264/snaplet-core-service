/**
 * Redis Key Feature Constants
 * Centralized constants for all Redis key features
 */
export const REDIS_KEY_FEATURES = {
  DEVICE_REGISTRATION: 'device-registration',
  USER_NOT_FOUND: 'user-not-found',
  RELATIONSHIPS: 'relationships', // Cache for relationships by status
  MY_FRIEND_IDS: 'my-friend-ids', // Cache for my accepted friend IDs (optimized for filtering)
  REFRESH_TOKEN: 'refresh-token',
  // Post unread (cache / session state)
  POST_UNREAD_LAST_SEEN_CACHE: 'post:last_seen_cache',
  POST_UNREAD_COUNT_CACHE: 'post:unread_count_cache',
  POST_SESSION_STATE: 'post:session_state',
  // Add more features here as needed
  // USER_SESSION: 'user-session',
  // RATE_LIMIT: 'rate-limit',
  // CACHE: 'cache',
} as const;

export type RedisKeyFeature =
  (typeof REDIS_KEY_FEATURES)[keyof typeof REDIS_KEY_FEATURES];
