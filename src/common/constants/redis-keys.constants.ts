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
  // Active auth session used to invalidate old access tokens immediately
  // (1 active auth session per user).
  AUTH_ACTIVE_SESSION: 'auth_active_session',
  // Post unread (cache / session state)
  POST_UNREAD_LAST_SEEN_CACHE: 'post:last_seen_cache',
  POST_UNREAD_COUNT_CACHE: 'post:unread_count_cache',
  POST_SESSION_STATE: 'post:session_state',
  POST_ACTIVITY_CACHE: 'post:activity_cache',
  POST_CREATE_DAILY_LIMIT: 'post:create_daily_limit',
  // Post reactions (owner actor list)
  POST_REACTIONS_CACHE: 'post:reactions_cache',
  // Chat conversation membership check
  CHAT_CONVERSATION_MEMBER: 'chat:conversation_member',
  // Chat partner profile cache (keyed by userId)
  CHAT_PARTNER_PROFILE: 'chat:partner_profile',
  // Chat last message per conversation cache (keyed by convId)
  CHAT_CONV_LAST_MESSAGE: 'chat:conv_last_msg',
  // Chat reactions per message (keyed by messageId)
  CHAT_MESSAGE_REACTIONS: 'chat:message_reactions',
  // Chat conversation restricted flag (keyed by convId) — set on unfriend, cleared on re-friend
  CHAT_CONV_RESTRICTED: 'chat:conv_restricted',
} as const;

export type RedisKeyFeature =
  (typeof REDIS_KEY_FEATURES)[keyof typeof REDIS_KEY_FEATURES];

/** WS presence flag — value `"1"`, TTL refreshed on connect and engine heartbeat. */
export const userPresenceKey = (userId: string): string => `presence:${userId}`;
