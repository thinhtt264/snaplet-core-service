import { NotificationType } from '../constants/notification.constants';

/** Chat FCM job discriminant — subset of {@link NotificationType}. */
export type ChatFcmNotificationType =
  | NotificationType.NEW_CHAT_MESSAGE
  | NotificationType.NEW_MESSAGE_REACTION;

export interface ReactionPushJobData {
  postOwnerId: string;
  postId: string;
  reactorId: string;
  reactorDisplayName: string;
  actorAvatarUrl: string | null;
  reactionIcon: string;
  type: NotificationType;
}

export interface WidgetRefreshPushJobData {
  recipientUserId: string;
  type: NotificationType.WIDGET_REFRESH;
}

export interface ChatFcmNewMessageJobPayload {
  type: NotificationType.NEW_CHAT_MESSAGE;
  conversationId: string;
  messageId: string;
  senderUserId: string;
  text?: string;
  hasImage: boolean;
}

export interface ChatFcmMessageReactionJobPayload {
  type: NotificationType.NEW_MESSAGE_REACTION;
  conversationId: string;
  messageId: string;
  reactorUserId: string;
  emoji: string;
}

export type ChatFcmJobPayload =
  | ChatFcmNewMessageJobPayload
  | ChatFcmMessageReactionJobPayload;

export interface ChatFcmPushJobData {
  recipientUserId: string;
  payload: ChatFcmJobPayload;
}
