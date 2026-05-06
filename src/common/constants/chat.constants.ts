// Redis key templates
export const TYPING_KEY = (convId: string, userId: string): string =>
  `typing:${convId}:${userId}`;

export const TYPING_TTL_MS = 5000;

// Pagination
export const CHAT_MESSAGE_PAGE_SIZE = 30;

// Archive
export const CHAT_ARCHIVE_QUEUE = 'chat-archive';

// Cache TTL
export const CHAT_CONVERSATION_MEMBER_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days
export const PARTNER_PROFILE_CACHE_TTL_SECONDS = 60 * 60; // 1 hour
export const CONV_LAST_MESSAGE_CACHE_TTL_SECONDS = 10 * 60; // 10 minutes
