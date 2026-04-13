// Redis key templates
export const TYPING_KEY = (convId: string, userId: string): string =>
  `typing:${convId}:${userId}`;

export const TYPING_TTL_MS = 5000;

// Pagination
export const CHAT_MESSAGE_PAGE_SIZE = 30;

// Archive
export const CHAT_ARCHIVE_QUEUE = 'chat-archive';
