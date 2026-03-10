import { Dialect, DialectName } from '../types';
import { BaseDialect } from './base.dialect';

/**
 * CockroachDB dialect
 *
 * CockroachDB is PostgreSQL-compatible and uses the same SQL syntax:
 * - Placeholders: $1, $2 (positional parameters)
 * - Identifier quoting: "double quotes"
 * - Pagination: LIMIT/OFFSET
 * - Case-insensitive LIKE: Uses LOWER(column) function
 *
 * This dialect is identical to PostgresDialect but provided as a separate
 * named dialect for clarity and potential future CockroachDB-specific optimizations.
 */
export class CockroachDialect extends BaseDialect {
  name: DialectName = 'cockroach';

  placeholder(position: number): string {
    return `$${position}`;
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }

  // Uses standard LIMIT/OFFSET, no special requirements
  requiresOrderByForPagination: boolean = false;
  mergesPaginationWithOrderBy: boolean = false;

  // Inherits default paginationClause from BaseDialect (LIMIT size OFFSET offset)
  // Inherits default orderByWithPagination from BaseDialect
}
