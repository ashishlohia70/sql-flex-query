import { DialectName } from '../types';
import { BaseDialect } from './base.dialect';
import { toPaginationNumber } from '../utils/helpers';

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
    page = toPaginationNumber(page, 'page');
    size = toPaginationNumber(size, 'size');
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
