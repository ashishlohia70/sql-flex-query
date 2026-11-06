import {
  Criteria,
  SortCriteria,
  ColumnMapper,
  BuildResult,
  BuildOptions,
  DialectName,
  CursorPagination,
} from '../types';
import { createDialect } from '../dialects';
import {
  prepareWhereClause,
  prepareHavingClause,
  prepareSelect,
  prepareOrderClause,
  prepareCursorClause,
} from './clause-builder';
import { resolveCursor, reverseSort } from './cursor';
import { toPaginationNumber } from '../utils/helpers';

export function buildQueries(options: BuildOptions): BuildResult;
export function buildQueries(
  baseQueryTemplate: string,
  whereParams?: Criteria[],
  textSearchParams?: Criteria[],
  sortBy?: SortCriteria[],
  page?: number,
  size?: number,
  columnMapper?: ColumnMapper,
  selectColumns?: string[],
  distinct?: boolean,
  modifyCountQuery?: ((query: string) => string) | null,
  dialectOptions?: { dialect?: DialectName }
): BuildResult;

export function buildQueries(
  baseQueryTemplateOrOptions: string | BuildOptions,
  whereParams: Criteria[] = [],
  textSearchParams: Criteria[] = [],
  sortBy: SortCriteria[] = [],
  page: number = 0,
  size: number = 10,
  columnMapper: ColumnMapper = {},
  selectColumns: string[] = [],
  distinct: boolean = false,
  modifyCountQuery: ((query: string) => string) | null = null,
  dialectOptions?: { dialect?: DialectName }
): BuildResult {
  let baseQueryTemplate: string;
  let dialectName: DialectName;
  let cursor: CursorPagination | undefined;

  if (typeof baseQueryTemplateOrOptions === 'object') {
    const opts = baseQueryTemplateOrOptions;
    baseQueryTemplate = opts.baseQueryTemplate;
    whereParams = opts.whereParams || [];
    textSearchParams = opts.textSearchParams || [];
    sortBy = opts.sortBy || [];
    page = opts.page || 0;
    size = opts.size || 10;
    columnMapper = opts.columnMapper || {};
    selectColumns = opts.selectColumns || [];
    distinct = opts.distinct || false;
    modifyCountQuery = opts.modifyCountQuery || null;
    dialectName = opts.dialect || 'postgres';
    cursor = opts.cursor;
  } else {
    baseQueryTemplate = baseQueryTemplateOrOptions;
    dialectName = dialectOptions?.dialect || 'postgres';
  }

  // Validate before any dialect sees them: custom dialects may interpolate as-is.
  page = toPaginationNumber(page, 'page');
  size = toPaginationNumber(size, 'size');

  const dialect = createDialect(dialectName);
  const resolvedCursor = cursor ? resolveCursor(cursor, sortBy, size) : null;

  const params: any[] = [];
  const havingCriteria = whereParams.filter((w) => w.having);
  const whereCriteria = whereParams.filter((w) => !w.having);

  // Param order must follow textual order: text search, where, cursor, having.
  const filterWhereClause = prepareWhereClause(
    whereCriteria,
    textSearchParams,
    params,
    columnMapper,
    dialect
  );
  const cursorClause = resolvedCursor?.values
    ? prepareCursorClause(
        sortBy,
        resolvedCursor.values,
        resolvedCursor.direction,
        params,
        columnMapper,
        dialect
      )
    : '';
  const whereClause = !cursorClause
    ? filterWhereClause
    : filterWhereClause
      ? `${filterWhereClause} AND ${cursorClause}`
      : ` WHERE ${cursorClause}`;
  const havingClause = prepareHavingClause(havingCriteria, params, columnMapper, dialect);

  // The count query reports the total, so it excludes the cursor condition and
  // needs its own params (placeholder positions shift without the cursor values).
  let countWhereClause = whereClause;
  let countHavingClause = havingClause;
  let countParams = [...params];
  if (cursorClause) {
    countParams = [];
    countWhereClause = prepareWhereClause(
      whereCriteria,
      textSearchParams,
      countParams,
      columnMapper,
      dialect
    );
    countHavingClause = prepareHavingClause(havingCriteria, countParams, columnMapper, dialect);
  }

  // Backward pages read in reverse order; buildCursorPage() flips the rows back.
  const effectiveSort =
    resolvedCursor?.direction === 'backward' ? reverseSort(sortBy) : sortBy;
  const orderClause = prepareOrderClause(effectiveSort, columnMapper, dialect);

  // Cursor mode always reads from the seek position: first "page", size + 1 rows
  // (the extra row tells buildCursorPage() whether another page exists).
  const pageNumber = resolvedCursor ? 1 : page;
  const pageSize = resolvedCursor ? size + 1 : size;

  let orderAndPagination: string;
  let limitClause: string;

  if (dialect.mergesPaginationWithOrderBy) {
    orderAndPagination = dialect.orderByWithPagination(orderClause, pageNumber, pageSize);
    limitClause = '';
  } else {
    orderAndPagination = orderClause;
    limitClause = dialect.paginationClause(pageNumber, pageSize);
    if (limitClause) {
      limitClause = ` ${limitClause}`;
    }
  }

  const searchQuery = baseQueryTemplate
    .replace(
      '/*SELECT_COLUMNS*/',
      prepareSelect(columnMapper, selectColumns, distinct, dialect)
    )
    .replace('/*WHERE_CLAUSE*/', whereClause)
    .replace('/*HAVING_CLAUSE*/', havingClause)
    .replace('/*ORDER_BY*/', orderAndPagination)
    .replace('/*LIMIT_CLAUSE*/', limitClause)
    .trim();

  const distinctClause =
    distinct && selectColumns.length > 0
      ? 'DISTINCT (' +
        selectColumns
          .map((col) => columnMapper[col] || col)
          .join(', ') +
        ')'
      : '1';
  const countExpr = modifyCountQuery ? '1' : `COUNT(${distinctClause}) AS count`;

  let countQuery = baseQueryTemplate
    .replace('/*SELECT_COLUMNS*/', countExpr)
    .replace('/*WHERE_CLAUSE*/', countWhereClause)
    .replace('/*HAVING_CLAUSE*/', countHavingClause)
    .replace('/*ORDER_BY*/', '')
    .replace('/*LIMIT_CLAUSE*/', '')
    .trim();

  if (modifyCountQuery) {
    countQuery = modifyCountQuery(countQuery);
  }

  const result: BuildResult = { searchQuery, countQuery, params, countParams };
  if (resolvedCursor) {
    result.cursorMeta = {
      sortBy: sortBy.map((s) => ({ ...s })),
      size,
      direction: resolvedCursor.direction,
      hasCursor: resolvedCursor.values !== null,
    };
  }
  return result;
}
