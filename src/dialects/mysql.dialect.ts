import { DialectName } from '../types';
import { BaseDialect } from './base.dialect';

export class MySQLDialect extends BaseDialect {
  name: DialectName = 'mysql';

  placeholder(_position: number): string {
    return '?';
  }

  quoteIdentifier(identifier: string): string {
    return `\`${identifier}\``;
  }

  lowerFunction(column: string): string {
    return column;
  }

  lowerValue(value: string): string {
    return value;
  }
}
