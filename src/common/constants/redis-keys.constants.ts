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
  POSTS_CACHE_UNREAD: 'posts:cache:unread', // Cached unread posts count per user
  POSTS_CACHE_LAST_SEEN_CURSOR: 'posts:cache:lastSeenCursor', // Cached last seen cursor per user
  POSTS_SESSION_UNREAD: 'posts:session:unread', // Session-scoped unread counter per user (SSE session)
  POSTS_SESSION_SEQ: 'posts:session:seq', // Session-scoped monotonic sequence per user (SSE session)
  // Add more features here as needed
  // USER_SESSION: 'user-session',
  // RATE_LIMIT: 'rate-limit',
  // CACHE: 'cache',
} as const;

export type RedisKeyFeature =
  (typeof REDIS_KEY_FEATURES)[keyof typeof REDIS_KEY_FEATURES];
