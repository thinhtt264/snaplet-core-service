export const SOCKET_USER_CONNECTED = 'socket.user_connected';
export const POSTS_UNREAD_UPDATED_EVENT = 'posts_unread_updated';
export const FRIEND_REQUEST_UPDATED_EVENT = 'friend_request_updated';

// Chat conversation-level events (emitted per-user via SocketService.emitToUser)
export const CONVERSATION_UPDATED = 'conversation_updated';
export const CONVERSATION_DELETED = 'conversation_deleted';

export interface UserConnectedEvent {
  userId: string;
  sessionId: string;
}

export interface PostsUnreadUpdatedEvent {
  count: number;
  seq: number;
}

export interface ConversationSeenPayload {
  conversationId: string;
  seenByUserId: string;
  messageId: string;
  seenAt: number;
}

export interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessageAt: Date;
  lastMessageText: string;
  lastMessageSenderId: string;
}

export interface ConversationDeletedPayload {
  conversationId: string;
}
