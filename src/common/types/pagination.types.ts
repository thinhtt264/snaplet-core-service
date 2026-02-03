/**
 * Cursor-based pagination metadata for list responses.
 * nextCursor is typically base64 encoded for API responses.
 * Client can infer "has next page" via: pagination.nextCursor != null
 */
export interface CursorPagination {
  limit: number;
  nextCursor: string | null;
}
