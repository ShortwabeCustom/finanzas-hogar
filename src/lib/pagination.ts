/**
 * Cursor-based pagination utility
 * Efficiently handles pagination using cursor-based approach instead of offset
 */

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
    totalCount?: number;
  };
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Decode cursor (base64 timestamp/id)
 */
export function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    return Buffer.from(cursor, "base64").toString("utf-8");
  } catch {
    return undefined;
  }
}

/**
 * Encode cursor (base64 timestamp/id)
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64");
}

/**
 * Parse pagination params from query string
 */
export function parsePaginationParams(
  limit?: string | null,
  cursor?: string | null
): PaginationParams {
  const parsedLimit = Math.min(
    Math.max(parseInt(limit ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );

  const decodedCursor = decodeCursor(cursor ?? undefined);

  return {
    limit: parsedLimit,
    cursor: decodedCursor,
  };
}

/**
 * Build paginated response
 * @param items - Array of items returned from DB (should be limit + 1)
 * @param limit - Page size
 * @param lastId - ID of last item (for cursor generation)
 */
export function buildPaginatedResponse<T>(
  items: T[],
  limit: number,
  lastId: string | Date | ((item: T) => string | Date)
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    const cursorValue = typeof lastId === "function" ? lastId(lastItem) : lastId;
    nextCursor = encodeCursor(String(cursorValue));
  }

  return {
    data,
    pagination: {
      limit,
      nextCursor,
      hasMore,
    },
  };
}
