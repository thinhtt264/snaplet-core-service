// Client → Server
export const CHAT_JOIN_CONVERSATION = 'chat:join';
export const CHAT_LEAVE_CONVERSATION = 'chat:leave';
export const CHAT_TYPING_START = 'chat:typing_start';
export const CHAT_TYPING_STOP = 'chat:typing_stop';
export const CHAT_MARK_READ = 'chat:mark_read';

// Server → Client
export const CHAT_MESSAGE_NEW = 'chat:message.new';
export const CHAT_MESSAGE_DELETED = 'chat:message.deleted';
export const CHAT_MESSAGE_READ = 'chat:message.read';
export const CHAT_MESSAGE_PINNED = 'chat:message.pinned';
export const CHAT_MESSAGE_UNPINNED = 'chat:message.unpinned';
export const CHAT_TYPING_START_EVT = 'chat:typing.start';
export const CHAT_TYPING_STOP_EVT = 'chat:typing.stop';

// Payload types
export interface ChatJoinPayload {
  conversationId: string;
}

export interface ChatTypingPayload {
  conversationId: string;
}

export interface ChatMarkReadPayload {
  conversationId: string;
  messageId: string;
}

export interface ChatTypingEventPayload {
  userId: string;
}

export interface ChatMessageReadEventPayload {
  userId: string;
  messageId: string;
  readAt: string;
}

export interface ChatMessageDeletedEventPayload {
  messageId: string;
}
