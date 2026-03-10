import { Dialect } from '../types';
import { PostgresDialect } from './postgres.dialect';
import { MySQLDialect } from './mysql.dialect';
import { SQLiteDialect } from './sqlite.dialect';
import { MSSQLDialect } from './mssql.dialect';
import { OracleDialect } from './oracle.dialect';
import { CockroachDialect } from './cockroach.dialect';
import { SnowflakeDialect } from './snowflake.dialect';

// Built-in dialect registry
const builtInDialects: Record<string, () => Dialect> = {
  postgres: () => new PostgresDialect(),
  mysql: () => new MySQLDialect(),
  sqlite: () => new SQLiteDialect(),
  mssql: () => new MSSQLDialect(),
  oracle: () => new OracleDialect(),
  cockroach: () => new CockroachDialect(),
  snowflake: () => new SnowflakeDialect(),
};

// Custom dialect registry for user-defined dialects
const customDialects: Record<string, () => Dialect> = {};

/**
 * Creates a dialect instance by name.
 * Checks custom dialects first, then built-in dialects.
 *
 * @param name - The dialect name (built-in or custom)
 * @returns A Dialect instance
 * @throws Error if dialect is not found
 */
export function createDialect(name: string): Dialect {
  // Check custom dialects first (allows overriding built-ins if needed)
  if (customDialects[name]) {
    return customDialects[name]();
  }

  const factory = builtInDialects[name];
  if (!factory) {
    const builtIn = Object.keys(builtInDialects).join(', ');
    const custom = Object.keys(customDialects).join(', ');
    const all = [...new Set([...Object.keys(builtInDialects), ...Object.keys(customDialects)])].join(', ');
    throw new Error(
      `Unsupported dialect: "${name}". ` +
      `Built-in: ${builtIn}${custom ? ` | Custom: ${custom}` : ''}. ` +
      `Use registerDialect() to add custom dialects.`
    );
  }
  return factory();
}

/**
 * Registers a custom dialect factory function.
 * Allows extending the library with new database dialects without modifying core code.
 *
 * @param name - Unique name for the dialect
 * @param factory - Factory function that returns a new Dialect instance
 *
 * @example
 * ```typescript
 * class MyDialect extends BaseDialect {
 *   name = 'mydb';
 *   placeholder(pos) { return `:${pos}`; }
 *   quoteIdentifier(id) { return `"${id}"`; }
 *   // ... other methods
 * }
 *
 * registerDialect('mydb', () => new MyDialect());
 * const dialect = createDialect('mydb');
 * ```
 */
export function registerDialect(name: string, factory: () => Dialect): void {
  customDialects[name] = factory;
}

// Re-export built-in dialects for direct usage
export { PostgresDialect } from './postgres.dialect';
export { MySQLDialect } from './mysql.dialect';
export { SQLiteDialect } from './sqlite.dialect';
export { MSSQLDialect } from './mssql.dialect';
export { OracleDialect } from './oracle.dialect';
export { CockroachDialect } from './cockroach.dialect';
export { SnowflakeDialect } from './snowflake.dialect';
export { BaseDialect } from './base.dialect';
