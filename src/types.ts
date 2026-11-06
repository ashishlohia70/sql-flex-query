export type Operation =
  | "EQ"
  | "NEQ"
  | "LIKE"
  | "NOT_LIKE"
  | "GT"
  | "LT"
  | "GTE"
  | "LTE"
  | "IN"
  | "NULL"
  | "NOT_NULL"
  | "BETWEEN";

/**
 * Built-in dialect names. For custom dialects, any string is allowed.
 * Use the `registerDialect()` function to add custom dialects.
 */
export const KNOWN_DIALECTS = [
  "postgres",
  "mysql",
  "sqlite",
  "mssql",
  "oracle",
  "cockroach",
  "snowflake",
] as const;
export type DialectName = (typeof KNOWN_DIALECTS)[number] | string;

export type SortDirection = "ASC" | "DESC";

export interface Criteria {
  key: string;
  operation: Operation;
  value?: any;
  ignoreCase?: boolean;
  having?: boolean;
}

export interface SortCriteria {
  key: string;
  direction: SortDirection;
}

export interface ColumnMapper {
  [key: string]: string;
}

/**
 * A cursor: either an opaque token produced by `encodeCursor()` /
 * `buildCursorPage()`, or a plain object of sort-key values
 * (e.g. `{ createdAt: '2024-01-01T00:00:00Z', id: 42 }`).
 */
export type CursorValue = string | Record<string, any>;

/**
 * Cursor-based (keyset) pagination input. Pass an empty object for the first page.
 * Set `after` to fetch the page following a cursor, or `before` to fetch the
 * page preceding it. `after` and `before` cannot be combined.
 */
export interface CursorPagination {
  after?: CursorValue | null;
  before?: CursorValue | null;
}

export type CursorDirection = 'forward' | 'backward';

/**
 * Returned on `BuildResult.cursorMeta` when cursor pagination is used.
 * Pass the whole `BuildResult` to `buildCursorPage()` to turn fetched rows into a page.
 */
export interface CursorMeta {
  /** Sort order as requested (not reversed for backward pages). */
  sortBy: SortCriteria[];
  /** Requested page size. The search query fetches `size + 1` rows to detect more pages. */
  size: number;
  direction: CursorDirection;
  /** Whether an `after`/`before` cursor was supplied (false on the first page). */
  hasCursor: boolean;
}

export interface CursorPage<T> {
  /** At most `size` rows, always in the requested sort order. */
  items: T[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  /** Pass as `after` to fetch the next page; null when there is none. */
  nextCursor: string | null;
  /** Pass as `before` to fetch the previous page; null when there is none. */
  prevCursor: string | null;
}

export interface BuildResult {
  searchQuery: string;
  countQuery: string;
  /** Parameters for `searchQuery`. */
  params: any[];
  /**
   * Parameters for `countQuery`. Identical to `params` unless a cursor is
   * applied: the count query reports the total and excludes the cursor condition.
   */
  countParams: any[];
  /** Present only when cursor pagination is used. */
  cursorMeta?: CursorMeta;
}

export interface BuildOptions {
  baseQueryTemplate: string;
  whereParams?: Criteria[];
  textSearchParams?: Criteria[];
  sortBy?: SortCriteria[];
  page?: number;
  size?: number;
  columnMapper?: ColumnMapper;
  selectColumns?: string[];
  distinct?: boolean;
  modifyCountQuery?: ((query: string) => string) | null;
  dialect?: DialectName;
  /**
   * Enables cursor-based (keyset) pagination instead of page/offset.
   * Requires `sortBy`, whose last key should be unique (e.g. `id`). `size` sets
   * the page size and `page` is ignored.
   */
  cursor?: CursorPagination;
}

export interface Dialect {
  name: DialectName;
  placeholder(position: number): string;
  quoteIdentifier(identifier: string): string;
  paginationClause(page: number, size: number): string;
  lowerFunction(column: string): string;
  lowerValue(value: string): string;
  requiresOrderByForPagination: boolean;
  mergesPaginationWithOrderBy: boolean;
  orderByWithPagination(
    orderClause: string,
    page: number,
    size: number,
  ): string;
}
