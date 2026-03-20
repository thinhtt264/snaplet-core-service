export const POSTS_UNREAD_QUEUE_NAME = 'posts-unread';

export const POSTS_UNREAD_JOB_CREATED = 'post.unread.created';
export const POSTS_UNREAD_JOB_DELETED = 'post.unread.deleted';
export const POSTS_UNREAD_JOB_MARK_SEEN = 'post.unread.mark-seen';

export type PostsUnreadJobName =
  | typeof POSTS_UNREAD_JOB_CREATED
  | typeof POSTS_UNREAD_JOB_DELETED
  | typeof POSTS_UNREAD_JOB_MARK_SEEN;
