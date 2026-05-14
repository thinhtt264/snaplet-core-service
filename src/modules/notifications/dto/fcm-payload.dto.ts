export type FcmDataPayload = Record<string, string>;

export interface NewChatMessagePayload {
  type: 'NEW_CHAT_MESSAGE';
  conversationId: string;
  messageId: string;
  senderName: string;
  senderAvatarUrl: string;
  text?: string;
  /** FCM data values are strings — `"true"` | `"false"` */
  hasImage: string;
}

export interface NewMessageReactionPayload {
  type: 'NEW_MESSAGE_REACTION';
  conversationId: string;
  messageId: string;
  reactorName: string;
  reactorAvatarUrl: string;
  emoji: string;
}

export type ChatNotificationPayload =
  | NewChatMessagePayload
  | NewMessageReactionPayload;

export function serializePayload(
  payload: ChatNotificationPayload,
): FcmDataPayload {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)]),
  );
}
