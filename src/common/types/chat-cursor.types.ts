/**
 * Compound cursor for chat message pagination.
 * Uses (createdAt DESC, id DESC) — same pattern as feed-cursor.types.ts in PostsModule.
 */
export interface ChatMessageCursor {
  createdAt: Date;
  id: string;
}

export function encodeChatCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.getTime()}_${row.id}`).toString('base64');
}

export function decodeChatCursor(cursor: string): ChatMessageCursor {
  const [ts, id] = Buffer.from(cursor, 'base64').toString().split('_');
  return {
    createdAt: new Date(Number(ts)),
    id,
  };
}

export function parseChatCursor(cursor?: string): ChatMessageCursor | null {
  if (!cursor) return null;
  try {
    return decodeChatCursor(cursor);
  } catch {
    return null;
  }
}
