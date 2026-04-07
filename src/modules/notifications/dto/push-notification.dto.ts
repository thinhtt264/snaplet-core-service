import { NotificationType } from '../constants/notification.constants';

export interface ReactionPushJobData {
  postOwnerId: string;
  postId: string;
  reactorId: string;
  reactorDisplayName: string;
  reactionIcon: string;
  type: NotificationType;
}
