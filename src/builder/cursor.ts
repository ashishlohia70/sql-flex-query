import {
  BuildResult,
  CursorDirection,
  CursorPage,
  CursorPagination,
  CursorValue,
  SortCriteria,
  SortDirection,
} from '../types';
import { decodeCursor, encodeCursor } from '../utils/cursor-codec';

export interface ResolvedCursor {
  direction: CursorDirection;
  /** Sort-key values to seek past; null on the first page. */
  values: Record<string, any> | null;
}

function isBindableValue(value: unknown): boolean {
  switch (typeof value) {
    case 'string':
    case 'boolean':
    case 'bigint':
      return true;
    case 'number':
      return Number.isFinite(value);
    default:
      return value instanceof Date && !isNaN(value.getTime());
  }
}

/**
 * Validates cursor pagination input and decodes the cursor (if any).
 *
 * Cursors usually come straight from client requests, so every sort-key value
 * must be a primitive or Date. Objects/arrays are rejected because some drivers
 * expand them into SQL fragments, and NULL can't be compared with `>` / `<`.
 */
export function resolveCursor(
  cursor: CursorPagination,
  sortBy: SortCriteria[],
  size: number,
): ResolvedCursor {
  if (!sortBy.length) {
    throw new Error(
      'Cursor pagination requires sortBy. End it with a unique column (e.g. id) so every row has a distinct position.',
    );
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('Cursor pagination requires size to be a positive integer.');
  }

  const hasAfter = cursor.after != null && cursor.after !== '';
  const hasBefore = cursor.before != null && cursor.before !== '';
  if (hasAfter && hasBefore) {
    throw new Error('Cursor pagination accepts either "after" or "before", not both.');
  }

  const direction: CursorDirection = hasBefore ? 'backward' : 'forward';
  const raw: CursorValue | null | undefined = hasBefore ? cursor.before : cursor.after;
  if (!hasAfter && !hasBefore) {
    return { direction, values: null };
  }

  const decoded = typeof raw === 'string' ? decodeCursor(raw) : raw;
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Invalid cursor');
  }

  const values: Record<string, any> = {};
  for (const { key } of sortBy) {
    if (!(key in decoded)) {
      throw new Error(
        `Cursor is missing a value for sort key "${key}". Was it created with a different sortBy?`,
      );
    }
    const value = (decoded as Record<string, any>)[key];
    if (value === null) {
      throw new Error(
        `Cursor value for sort key "${key}" is null. Cursor pagination requires non-null sort columns.`,
      );
    }
    if (!isBindableValue(value)) {
      throw new Error(
        `Cursor value for sort key "${key}" must be a string, number, boolean, bigint or Date.`,
      );
    }
    values[key] = value;
  }

  return { direction, values };
}

/** Flips every sort direction (used to read backward from a `before` cursor). */
export function reverseSort(sortBy: SortCriteria[]): SortCriteria[] {
  return sortBy.map((s) => ({
    key: s.key,
    direction: (String(s.direction).toUpperCase() === 'DESC' ? 'ASC' : 'DESC') as SortDirection,
  }));
}

function readSortValue(row: Record<string, any>, key: string): any {
  if (row[key] !== undefined) {
    return row[key];
  }
  // 'u.created_at' is returned by the driver as 'created_at'
  const bare = key.slice(key.lastIndexOf('.') + 1);
  if (bare !== key && row[bare] !== undefined) {
    return row[bare];
  }
  throw new Error(
    `Cannot build cursor: row has no "${key}" field. Select the sort column under that name ` +
      `(selectColumns with columnMapper aliases it automatically), or build the cursor yourself with encodeCursor().`,
  );
}

function cursorFromRow(row: Record<string, any>, sortBy: SortCriteria[]): string {
  const values: Record<string, any> = {};
  for (const { key } of sortBy) {
    values[key] = readSortValue(row, key);
  }
  return encodeCursor(values);
}

/**
 * Turns rows fetched with a cursor-paginated `searchQuery` into a page:
 * trims the look-ahead row, restores the requested order for backward pages,
 * and builds the next/previous cursors from the first and last items.
 *
 * Each row must expose every sort key as a field (see `selectColumns`).
 *
 * @example
 * const result = new QueryBuilder('postgres')
 *   .baseQuery(BASE)
 *   .orderBy([{ key: 'createdAt', direction: 'DESC' }, { key: 'id', direction: 'DESC' }])
 *   .cursorPaginate(20, { after: req.query.cursor })
 *   .build();
 * const { rows } = await pool.query(result.searchQuery, result.params);
 * const page = buildCursorPage(rows, result);
 * // { items, hasNextPage, hasPreviousPage, nextCursor, prevCursor }
 */
export function buildCursorPage<T extends Record<string, any>>(
  rows: T[],
  result: Pick<BuildResult, 'cursorMeta'>,
): CursorPage<T> {
  const meta = result.cursorMeta;
  if (!meta) {
    throw new Error(
      'buildCursorPage() needs a result built with cursor pagination (the "cursor" option or cursorPaginate()).',
    );
  }

  const { size, sortBy, direction, hasCursor } = meta;
  const hasMore = rows.length > size;
  const items = rows.slice(0, size);
  if (direction === 'backward') {
    items.reverse();
  }

  const hasNextPage = direction === 'forward' ? hasMore : hasCursor;
  const hasPreviousPage = direction === 'forward' ? hasCursor : hasMore;
  const first = items[0];
  const last = items[items.length - 1];

  return {
    items,
    hasNextPage,
    hasPreviousPage,
    nextCursor: hasNextPage && last ? cursorFromRow(last, sortBy) : null,
    prevCursor: hasPreviousPage && first ? cursorFromRow(first, sortBy) : null,
  };
}
