import { Dialect, DialectName } from '../types';

export abstract class BaseDialect implements Dialect {
  abstract name: DialectName;
  abstract placeholder(position: number): string;
  abstract quoteIdentifier(identifier: string): string;

  lowerFunction(column: string): string {
    return `LOWER(${column})`;
  }

  lowerValue(value: string): string {
    return value.toLowerCase();
  }

  requiresOrderByForPagination: boolean = false;
  mergesPaginationWithOrderBy: boolean = false;

  paginationClause(page: number, size: number): string {
    if (!page || !size) {
      return '';
    }
    const offset = (page - 1) * size;
    return `LIMIT ${size} OFFSET ${offset}`;
  }

  orderByWithPagination(orderClause: string, page: number, size: number): string {
    const pagination = this.paginationClause(page, size);
    return [orderClause, pagination].filter(Boolean).join(' ');
  }
}
