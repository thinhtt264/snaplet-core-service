import { Types } from 'mongoose';

/**
 * Cursor for cursor-based pagination
 * Uses compound key (createdAt, _id) for stable pagination
 */
export interface FeedCursor {
  createdAt: Date;
  _id: Types.ObjectId;
}

/**
 * Encode cursor to string
 * Format: timestamp_hexObjectId (base64 encoded)
 */
export function encodeCursor(post: {
  createdAt: Date;
  _id: Types.ObjectId;
}): string {
  return Buffer.from(
    `${post.createdAt.getTime()}_${post._id.toHexString()}`,
  ).toString('base64');
}

/**
 * Decode cursor from string
 * Format: timestamp_hexObjectId (base64 encoded)
 */
export function decodeCursor(cursor: string): FeedCursor {
  const [ts, id] = Buffer.from(cursor, 'base64').toString().split('_');

  return {
    createdAt: new Date(Number(ts)),
    _id: new Types.ObjectId(id),
  };
}

/**
 * Parse cursor from string (with null check)
 * Returns null if cursor is invalid or missing
 */
export function parseCursor(cursor?: string): FeedCursor | null {
  if (!cursor) return null;
  try {
    return decodeCursor(cursor);
  } catch {
    return null;
  }
}
