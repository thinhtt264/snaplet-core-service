export interface PostUnreadCreatedJobData {
  authorId: string;
  recipientUserIds: string[];
}

export interface PostUnreadDeletedJobData {
  authorId: string;
  recipientUserIds: string[];
}

export interface PostUnreadMarkSeenJobData {
  userId: string;
  lastSeenPostCreatedAt: string;
}

export type PostsUnreadJobData =
  | PostUnreadCreatedJobData
  | PostUnreadDeletedJobData
  | PostUnreadMarkSeenJobData;

export type PostsUnreadJobPayloadMap = {
  'post.unread.created': PostUnreadCreatedJobData;
  'post.unread.deleted': PostUnreadDeletedJobData;
  'post.unread.mark-seen': PostUnreadMarkSeenJobData;
};
