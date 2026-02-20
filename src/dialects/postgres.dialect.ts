import { DialectName } from '../types';
import { BaseDialect } from './base.dialect';

export class PostgresDialect extends BaseDialect {
  name: DialectName = 'postgres';

  placeholder(position: number): string {
    return `$${position}`;
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
}
