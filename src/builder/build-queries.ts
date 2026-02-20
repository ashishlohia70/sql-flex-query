import {
  Criteria,
  SortCriteria,
  ColumnMapper,
  BuildResult,
  BuildOptions,
  DialectName,
} from '../types';
import { createDialect } from '../dialects';
import {
  prepareWhereClause,
  prepareHavingClause,
  prepareSelect,
  prepareOrderClause,
} from './clause-builder';

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
  } else {
    baseQueryTemplate = baseQueryTemplateOrOptions;
    dialectName = dialectOptions?.dialect || 'postgres';
  }

  const dialect = createDialect(dialectName);

  const params: any[] = [];
  const havingCriteria = whereParams.filter((w) => w.having);
  const whereCriteria = whereParams.filter((w) => !w.having);

  const whereClause = prepareWhereClause(
    whereCriteria,
    textSearchParams,
    params,
    columnMapper,
    dialect
  );
  const havingClause = prepareHavingClause(havingCriteria, params, columnMapper, dialect);
  const orderClause = prepareOrderClause(sortBy, columnMapper, dialect);

  let orderAndPagination: string;
  let limitClause: string;

  if (dialect.mergesPaginationWithOrderBy) {
    orderAndPagination = dialect.orderByWithPagination(orderClause, page, size);
    limitClause = '';
  } else {
    orderAndPagination = orderClause;
    limitClause = dialect.paginationClause(page, size);
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
    .replace('/*WHERE_CLAUSE*/', whereClause)
    .replace('/*HAVING_CLAUSE*/', havingClause)
    .replace('/*ORDER_BY*/', '')
    .replace('/*LIMIT_CLAUSE*/', '')
    .trim();

  if (modifyCountQuery) {
    countQuery = modifyCountQuery(countQuery);
  }

  return { searchQuery, countQuery, params };
}
