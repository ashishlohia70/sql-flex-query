import { DialectName } from '../types';
import { BaseDialect } from './base.dialect';

export class MSSQLDialect extends BaseDialect {
  name: DialectName = 'mssql';
  requiresOrderByForPagination: boolean = true;
  mergesPaginationWithOrderBy: boolean = true;

  placeholder(position: number): string {
    return `@p${position}`;
  }

  quoteIdentifier(identifier: string): string {
    return `[${identifier}]`;
  }

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
      return `ORDER BY (SELECT NULL) ${pagination}`;
    }
    return `${orderClause} ${pagination}`;
  }
}
