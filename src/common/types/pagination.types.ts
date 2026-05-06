export interface CursorPagination {
  limit: number;
  nextCursor: string | null;
}

export interface CursorPage<T> {
  data: T[];
  pagination: CursorPagination;
}
