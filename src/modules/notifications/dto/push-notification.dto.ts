import { NotificationType } from '../constants/notification.constants';

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
