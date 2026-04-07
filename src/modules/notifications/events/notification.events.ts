export const REACTION_CREATED_FOR_NOTIFICATION_EVENT =
  'notification.reaction_created';

export interface ReactionCreatedNotificationPayload {
  postId: string;
  postOwnerId: string;
  reactorId: string;
  reactorDisplayName: string;
  reactionIcon: string;
}
