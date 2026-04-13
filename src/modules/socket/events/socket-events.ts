export const SOCKET_USER_CONNECTED = 'socket.user_connected';
export const POSTS_UNREAD_UPDATED_EVENT = 'posts_unread_updated';
export const FRIEND_REQUEST_RECEIVED_EVENT = 'friend_request_received';

export interface UserConnectedEvent {
  userId: string;
  sessionId: string;
}

export interface PostsUnreadUpdatedEvent {
  count: number;
  seq: number;
}
