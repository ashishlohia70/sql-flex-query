import { Dialect, DialectName } from '../types';
import { BaseDialect } from './base.dialect';

/**
 * Snowflake dialect
 *
 * Features:
 * - Placeholders: ? (positional parameters)
 * - Identifier quoting: "double quotes"
 * - Pagination: LIMIT/OFFSET
 * - Case-insensitive LIKE: Uses LOWER(column) function (Snowflake LIKE is case-sensitive by default)
 */
export class SnowflakeDialect extends BaseDialect {
  name: DialectName = 'snowflake';

  placeholder(_position: number): string {
    return '?';
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
