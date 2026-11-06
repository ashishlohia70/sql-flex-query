import {
  Criteria,
  SortCriteria,
  ColumnMapper,
  BuildResult,
  DialectName,
  SortDirection,
  CursorPagination,
} from '../types';
import { buildQueries } from './build-queries';

export class QueryBuilder {
  private _dialect: DialectName;
  private _baseQueryTemplate: string = '';
  private _whereParams: Criteria[] = [];
  private _textSearchParams: Criteria[] = [];
  private _sortBy: SortCriteria[] = [];
  private _page: number = 0;
  private _size: number = 0;
  private _columnMapper: ColumnMapper = {};
  private _selectColumns: string[] = [];
  private _distinct: boolean = false;
  private _modifyCountQuery: ((query: string) => string) | null = null;
  private _cursor: CursorPagination | null = null;

  constructor(dialect: DialectName = 'postgres') {
    this._dialect = dialect;
  }

  baseQuery(template: string): this {
    this._baseQueryTemplate = template;
    return this;
  }

  columnMapper(mapper: ColumnMapper): this {
    this._columnMapper = mapper;
    return this;
  }

  select(columns: string[]): this {
    this._selectColumns = columns;
    return this;
  }

  where(criteria: Criteria | Criteria[]): this {
    const items = Array.isArray(criteria) ? criteria : [criteria];
    this._whereParams.push(...items);
    return this;
  }

  textSearch(criteria: Criteria | Criteria[]): this {
    const items = Array.isArray(criteria) ? criteria : [criteria];
    this._textSearchParams.push(...items);
    return this;
  }

  having(criteria: Criteria | Criteria[]): this {
    const items = Array.isArray(criteria) ? criteria : [criteria];
    items.forEach((c) => (c.having = true));
    this._whereParams.push(...items);
    return this;
  }

  orderBy(sort: SortCriteria | SortCriteria[]): this {
    const items = Array.isArray(sort) ? sort : [sort];
    this._sortBy.push(...items);
    return this;
  }

  sortBy(key: string, direction: SortDirection = 'ASC'): this {
    this._sortBy.push({ key, direction });
    return this;
  }

  /** Page/offset pagination (1-based page). Replaces any earlier cursorPaginate(). */
  paginate(page: number, size: number): this {
    this._page = page;
    this._size = size;
    this._cursor = null;
    return this;
  }

  /**
   * Cursor-based (keyset) pagination. Replaces any earlier paginate().
   * Requires orderBy()/sortBy(); end the sort with a unique column such as id.
   * The search query fetches `size + 1` rows: pass them to buildCursorPage().
   *
   * @param size - Page size
   * @param cursor - `{}` (or omitted) for the first page, `{ after }` for the next page, `{ before }` for the previous page
   */
  cursorPaginate(size: number, cursor: CursorPagination = {}): this {
    this._page = 0;
    this._size = size;
    this._cursor = cursor;
    return this;
  }

  distinct(enabled: boolean = true): this {
    this._distinct = enabled;
    return this;
  }

  modifyCountQuery(fn: (query: string) => string): this {
    this._modifyCountQuery = fn;
    return this;
  }

  build(): BuildResult {
    if (!this._baseQueryTemplate) {
      throw new Error('baseQuery() must be called before build()');
    }

    return buildQueries({
      baseQueryTemplate: this._baseQueryTemplate,
      whereParams: this._whereParams,
      textSearchParams: this._textSearchParams,
      sortBy: this._sortBy,
      page: this._page,
      size: this._size,
      columnMapper: this._columnMapper,
      selectColumns: this._selectColumns,
      distinct: this._distinct,
      modifyCountQuery: this._modifyCountQuery,
      dialect: this._dialect,
      cursor: this._cursor ?? undefined,
    });
  }

  reset(): this {
    this._baseQueryTemplate = '';
    this._whereParams = [];
    this._textSearchParams = [];
    this._sortBy = [];
    this._page = 0;
    this._size = 0;
    this._columnMapper = {};
    this._selectColumns = [];
    this._distinct = false;
    this._modifyCountQuery = null;
    this._cursor = null;
    return this;
  }
}
