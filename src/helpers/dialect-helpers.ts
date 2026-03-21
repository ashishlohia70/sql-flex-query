import { DialectName, ColumnMapper, Criteria, Dialect } from '../types';
import { createDialect } from '../dialects';
import { getKey, addQuotesIfMissing } from '../utils/helpers';
import { prepareClause, prepareWhereClause } from '../builder/clause-builder';

/**
 * Result of building INSERT values
 */
export interface InsertBuildResult {
  columns: string[];
  placeholders: string[];
  params: any[];
}

/**
 * Result of building UPDATE SET clause
 */
export interface UpdateBuildResult {
  setClause: string;
  params: any[];
  /** Next placeholder position (useful if you need to add more params like WHERE id = $N) */
  nextPosition: number;
}

/**
 * Dialect-aware helper functions for building INSERT, UPDATE, and custom queries.
 *
 * Usage:
 *   const helpers = dialectHelpers('postgres');
 *   const ph = helpers.placeholder(1);          // '$1'
 *   const col = helpers.quoteIdentifier('name'); // '"name"'
 *   const key = helpers.getKey(mapper, 'firstName'); // mapper value or quoted key
 */
export interface DialectHelperFunctions {
  /** The underlying dialect instance */
  dialect: Dialect;

  /** The dialect name */
  name: DialectName;

  /**
   * Returns the placeholder for a given position (1-based).
   * Postgres: $1 | MySQL: ? | MSSQL: @p1 | SQLite: ?
   */
  placeholder: (position: number) => string;

  /**
   * Wraps an identifier in dialect-specific quotes.
   * Postgres: "col" | MySQL: \`col\` | MSSQL: [col]
   */
  quoteIdentifier: (identifier: string) => string;

  /**
   * Gets the actual column name from mapper, or quotes the raw key.
   */
  getKey: (columnMapper: ColumnMapper, key: string) => string;

  /**
   * Builds a parameterized WHERE clause string from criteria.
   * Returns { clause: string, params: any[] }
   *
   * Pass `existingParams` to continue placeholder numbering from a previous
   * SET clause (for UPDATE) or any other params array.
   *
   * Example (standalone):
   *   const { clause, params } = helpers.buildWhereClause(
   *     [{ key: 'status', operation: 'EQ', value: 'ACTIVE' }],
   *     [],
   *     { status: 'u.status' }
   *   );
   *   // clause: ' WHERE u.status = $1'
   *   // params: ['ACTIVE']
   *
   * Example (after SET clause — placeholders continue from $3):
   *   const { setClause, params } = helpers.buildSetClause(data, mapper);
   *   const { clause } = helpers.buildWhereClause(
   *     [{ key: 'id', operation: 'EQ', value: 42 }],
   *     [], mapper, params
   *   );
   *   // clause: ' WHERE u.id = $3'
   *   // params: [...setParams, 42]  (same array, mutated)
   */
  buildWhereClause: (
    whereParams: Criteria[],
    textSearchParams?: Criteria[],
    columnMapper?: ColumnMapper,
    existingParams?: any[]
  ) => { clause: string; params: any[] };

  /**
   * Builds a single condition clause.
   * Useful for custom query construction.
   *
   * Example:
   *   const params: any[] = [];
   *   const clause = helpers.buildClause(
   *     { key: 'status', operation: 'EQ', value: 'ACTIVE' },
   *     params,
   *     { status: 'u.status' }
   *   );
   *   // clause: 'u.status = $1'
   *   // params: ['ACTIVE']
   */
  buildClause: (
    criteria: Criteria,
    params: any[],
    columnMapper?: ColumnMapper
  ) => string;

  /**
   * Builds INSERT column list and placeholders from a data object.
   *
   * Example:
   *   const { columns, placeholders, params } = helpers.buildInsertValues(
   *     { name: 'John', email: 'john@example.com', age: 30 },
   *     { name: 'u.name', email: 'u.email', age: 'u.age' }
   *   );
   *   // columns: ['u.name', 'u.email', 'u.age']
   *   // placeholders: ['$1', '$2', '$3'] (postgres)
   *   // params: ['John', 'john@example.com', 30]
   */
  buildInsertValues: (
    data: Record<string, any>,
    columnMapper?: ColumnMapper
  ) => InsertBuildResult;

  /**
   * Builds UPDATE SET clause from a data object.
   *
   * Example:
   *   const { setClause, params, nextPosition } = helpers.buildSetClause(
   *     { name: 'Jane', email: 'jane@example.com' },
   *     { name: 'u.name', email: 'u.email' }
   *   );
   *   // setClause: 'u.name = $1, u.email = $2'
   *   // params: ['Jane', 'jane@example.com']
   *   // nextPosition: 3
   */
  buildSetClause: (
    data: Record<string, any>,
    columnMapper?: ColumnMapper,
    startPosition?: number
  ) => UpdateBuildResult;

  /**
   * Returns the dialect's pagination clause.
   */
  paginationClause: (page: number, size: number) => string;

  /**
   * Wraps a column for case-insensitive comparison.
   */
  lowerFunction: (column: string) => string;

  /**
   * Transforms a value for case-insensitive comparison.
   */
  lowerValue: (value: string) => string;
}

/**
 * Creates dialect-aware helper functions for building INSERT, UPDATE, and custom queries.
 *
 * @param dialectName - The database dialect ('postgres', 'mysql', 'sqlite', 'mssql')
 * @returns An object with helper functions bound to the specified dialect
 *
 * @example
 * const helpers = dialectHelpers('postgres');
 *
 * // Build INSERT
 * const { columns, placeholders, params } = helpers.buildInsertValues(data, mapper);
 * const query = `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
 *
 * // Build UPDATE
 * const { setClause, params: updateParams, nextPosition } = helpers.buildSetClause(data, mapper);
 * updateParams.push(id);
 * const query = `UPDATE users SET ${setClause} WHERE id = ${helpers.placeholder(nextPosition)} RETURNING *`;
 */
export function dialectHelpers(dialectName: DialectName): DialectHelperFunctions {
  const dialect = createDialect(dialectName);

  return {
    dialect,
    name: dialectName,

    placeholder: (position: number) => dialect.placeholder(position),

    quoteIdentifier: (identifier: string) => dialect.quoteIdentifier(identifier),

    getKey: (columnMapper: ColumnMapper, key: string) =>
      getKey(columnMapper, key, dialect),

    buildWhereClause: (
      whereParams: Criteria[],
      textSearchParams: Criteria[] = [],
      columnMapper: ColumnMapper = {},
      existingParams?: any[]
    ) => {
      const params = existingParams ?? [];
      const clause = prepareWhereClause(
        whereParams,
        textSearchParams,
        params,
        columnMapper,
        dialect
      );
      return { clause, params };
    },

    buildClause: (
      criteria: Criteria,
      params: any[],
      columnMapper: ColumnMapper = {}
    ) => {
      return prepareClause(criteria, params, columnMapper, dialect);
    },

    buildInsertValues: (
      data: Record<string, any>,
      columnMapper: ColumnMapper = {}
    ): InsertBuildResult => {
      const columns: string[] = [];
      const placeholders: string[] = [];
      const params: any[] = [];
      let position = 1;

      for (const [key, value] of Object.entries(data)) {
        columns.push(getKey(columnMapper, key, dialect));
        placeholders.push(dialect.placeholder(position));
        params.push(value);
        position++;
      }

      return { columns, placeholders, params };
    },

    buildSetClause: (
      data: Record<string, any>,
      columnMapper: ColumnMapper = {},
      startPosition: number = 1
    ): UpdateBuildResult => {
      const setClauses: string[] = [];
      const params: any[] = [];
      let position = startPosition;

      for (const [key, value] of Object.entries(data)) {
        const col = getKey(columnMapper, key, dialect);
        setClauses.push(`${col} = ${dialect.placeholder(position)}`);
        params.push(value);
        position++;
      }

      return {
        setClause: setClauses.join(', '),
        params,
        nextPosition: position,
      };
    },

    paginationClause: (page: number, size: number) =>
      dialect.paginationClause(page, size),

    lowerFunction: (column: string) => dialect.lowerFunction(column),

    lowerValue: (value: string) => dialect.lowerValue(value),
  };
}
