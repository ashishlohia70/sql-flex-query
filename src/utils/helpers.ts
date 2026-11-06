import { Dialect } from '../types';

export function addQuotesIfMissing(str: string, dialect: Dialect): string {
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith('`') && str.endsWith('`')) ||
    (str.startsWith('[') && str.endsWith(']'))
  ) {
    return str;
  }
  if (str.includes('.')) {
    return str;
  }
  return dialect.quoteIdentifier(str);
}

function describeValue(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    return JSON.stringify(value.length > 32 ? `${value.slice(0, 32)}...` : value);
  }
  return typeof value;
}

/**
 * Validates a page or size before it is interpolated into a LIMIT/OFFSET/FETCH clause.
 * Placeholders can't be used there portably, so this is what keeps the clause injection-safe.
 *
 * - Falsy values (0, null, undefined, NaN, '') mean "not set" and return 0, as before.
 * - Non-negative safe integers are returned unchanged.
 * - Digit-only strings ("20", e.g. straight from a query string) are converted to numbers.
 * - Anything else (negative, fractional, "10; DROP TABLE ...", objects) throws.
 *
 * Only the returned number may be written into SQL, never the original value.
 */
export function toPaginationNumber(value: unknown, name: 'page' | 'size'): number {
  if (!value) {
    return 0;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error(
    `Invalid ${name}: expected a non-negative integer, received ${describeValue(value)}.`
  );
}

export function getKey(
  columnMapper: { [key: string]: string },
  key: string,
  dialect: Dialect
): string {
  return columnMapper[key] || addQuotesIfMissing(key, dialect);
}
