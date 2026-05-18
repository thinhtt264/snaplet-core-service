export const CHAT_MESSAGE_SENT_EVENT = 'chat.message.sent';
export const CHAT_MESSAGE_REACTED_EVENT = 'chat.message.reacted';

export class ChatMessageSentEvent {
  recipientUserId: string;
  conversationId: string;
  messageId: string;
  senderUserId: string;
  text: string | null;
  hasImage: boolean;
}

export class ChatMessageReactedEvent {
  recipientUserId: string;
  conversationId: string;
  messageId: string;
  reactorUserId: string;
  emoji: string;
}
