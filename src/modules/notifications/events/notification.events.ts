export const REACTION_CREATED_FOR_NOTIFICATION_EVENT =
  'notification.reaction_created';

export interface ReactionCreatedNotificationPayload {
  deeplink: string;
  postOwnerId: string;
  reactorId: string;
  reactorDisplayName: string;
  largeIconUrl: string | null;
  reactionIcon: string;
}

export const FRIEND_REQUEST_CREATED_NOTIFICATION_EVENT =
  'notification.friend_request_created';

export interface FriendRequestCreatedNotificationPayload {
  initiatorId: string;
  initiatorUsername: string | null;
  targetUserId: string;
  initiatorDisplayName: string;
  initiatorAvatarUrl: string | null;
}
