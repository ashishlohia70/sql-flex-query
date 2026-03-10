// Query builders
export { buildQueries } from './builder/build-queries';
export { QueryBuilder } from './builder/query-builder';

// Dialect helpers for INSERT/UPDATE/custom queries
export { dialectHelpers } from './helpers/dialect-helpers';

// Low-level clause builders (for advanced users)
export {
  prepareClause,
  prepareWhereClause,
  prepareHavingClause,
  prepareSelect,
  prepareOrderClause,
} from './builder/clause-builder';

// Utility functions
export { getKey, addQuotesIfMissing } from './utils/helpers';

// Dialect classes
export {
  createDialect,
  PostgresDialect,
  MySQLDialect,
  SQLiteDialect,
  MSSQLDialect,
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
} from './types';

export type {
  InsertBuildResult,
  UpdateBuildResult,
  DialectHelperFunctions,
} from './helpers/dialect-helpers';
