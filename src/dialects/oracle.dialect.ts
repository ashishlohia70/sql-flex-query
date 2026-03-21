import { Dialect, DialectName } from '../types';
import { BaseDialect } from './base.dialect';

/**
 * Oracle Database dialect (12c+)
 *
 * Features:
 * - Placeholders: :1, :2 (positional bind variables)
 * - Identifier quoting: "double quotes"
 * - Pagination: OFFSET N ROWS FETCH NEXT M ROWS ONLY (requires ORDER BY)
 * - Case-insensitive LIKE: Uses LOWER(column) function
 */
export class OracleDialect extends BaseDialect {
  name: DialectName = 'oracle';

  placeholder(position: number): string {
    return `:${position}`;
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }

  // Oracle requires ORDER BY for OFFSET/FETCH
  requiresOrderByForPagination: boolean = true;
  mergesPaginationWithOrderBy: boolean = true;

  paginationClause(page: number, size: number): string {
    if (!page || !size) {
      return '';
    }
    const offset = (page - 1) * size;
    return `OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY`;
  }

  orderByWithPagination(orderClause: string, page: number, size: number): string {
    const pagination = this.paginationClause(page, size);
    if (!pagination) {
      return orderClause;
    }
    if (!orderClause) {
      // Oracle requires ORDER BY when using OFFSET/FETCH
      return `ORDER BY (SELECT NULL) ${pagination}`;
    }
    return `${orderClause} ${pagination}`;
  }
}
