/**
 * Domain events for Posts, specifically for SSE feed/unread logic.
 * These are consumed by SSE listeners and emitters only.
 */
export const POST_SSE_EVENTS = {
  POST_CREATED: 'post.created',
} as const;

export type PostSseEvent =
  (typeof POST_SSE_EVENTS)[keyof typeof POST_SSE_EVENTS];
