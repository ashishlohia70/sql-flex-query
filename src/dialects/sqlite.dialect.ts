import { DialectName } from '../types';
import { BaseDialect } from './base.dialect';

export class SQLiteDialect extends BaseDialect {
  name: DialectName = 'sqlite';

  placeholder(_position: number): string {
    return '?';
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
}
