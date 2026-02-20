import { Dialect, DialectName } from '../types';
import { PostgresDialect } from './postgres.dialect';
import { MySQLDialect } from './mysql.dialect';
import { SQLiteDialect } from './sqlite.dialect';
import { MSSQLDialect } from './mssql.dialect';

const dialects: Record<DialectName, () => Dialect> = {
  postgres: () => new PostgresDialect(),
  mysql: () => new MySQLDialect(),
  sqlite: () => new SQLiteDialect(),
  mssql: () => new MSSQLDialect(),
};

export function createDialect(name: DialectName): Dialect {
  const factory = dialects[name];
  if (!factory) {
    const supported = Object.keys(dialects).join(', ');
    throw new Error(
      `Unsupported dialect: "${name}". Supported dialects: ${supported}`
    );
  }
  return factory();
}

export { PostgresDialect } from './postgres.dialect';
export { MySQLDialect } from './mysql.dialect';
export { SQLiteDialect } from './sqlite.dialect';
export { MSSQLDialect } from './mssql.dialect';
export { BaseDialect } from './base.dialect';
