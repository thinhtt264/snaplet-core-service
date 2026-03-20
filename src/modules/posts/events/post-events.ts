/**
 * Internal events for post domain (e.g. emitted after create for WS session unread).
 */
export const POST_CREATED_EVENT = 'post.created';

export interface PostCreatedEvent {
  authorId: string;
  postCreatedAt: Date;
}
