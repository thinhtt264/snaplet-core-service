import { NotificationType } from '../constants/notification.constants';
import type {
  NewChatMessagePayload,
  NewMessageReactionPayload,
} from './fcm-payload.dto';

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

export interface ChatFcmPushJobData {
  recipientUserId: string;
  payload:
    | (Pick<
        NewChatMessagePayload,
        'type' | 'conversationId' | 'messageId' | 'text'
      > & {
        senderUserId: string;
        hasImage: boolean;
      })
    | (Pick<
        NewMessageReactionPayload,
        'type' | 'conversationId' | 'messageId' | 'emoji'
      > & {
        reactorUserId: string;
      });
}
