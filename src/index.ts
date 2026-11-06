// Query builders
export { buildQueries } from './builder/build-queries';
export { QueryBuilder } from './builder/query-builder';

// Cursor (keyset) pagination
export { buildCursorPage } from './builder/cursor';
export { encodeCursor, decodeCursor } from './utils/cursor-codec';

// Dialect helpers for INSERT/UPDATE/custom queries
export { dialectHelpers } from './helpers/dialect-helpers';

// Low-level clause builders (for advanced users)
export {
  prepareClause,
  prepareWhereClause,
  prepareHavingClause,
  prepareSelect,
  prepareOrderClause,
  prepareCursorClause,
} from './builder/clause-builder';

// Utility functions
export { getKey, addQuotesIfMissing } from './utils/helpers';

// Dialect classes
export {
  createDialect,
  registerDialect,
  PostgresDialect,
  MySQLDialect,
  SQLiteDialect,
  MSSQLDialect,
  OracleDialect,
  CockroachDialect,
  SnowflakeDialect,
  BaseDialect,
} from './dialects';

// Types
export type {
  Criteria,
  SortCriteria,
  ColumnMapper,
  BuildResult,
  BuildOptions,
  Dialect,
  DialectName,
  Operation,
  SortDirection,
  CursorValue,
  CursorPagination,
  CursorDirection,
  CursorMeta,
  CursorPage,
} from './types';

export type {
  InsertBuildResult,
  UpdateBuildResult,
  DialectHelperFunctions,
} from './helpers/dialect-helpers';
