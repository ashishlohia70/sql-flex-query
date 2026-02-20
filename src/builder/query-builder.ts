import {
  Criteria,
  SortCriteria,
  ColumnMapper,
  BuildResult,
  DialectName,
  SortDirection,
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

  paginate(page: number, size: number): this {
    this._page = page;
    this._size = size;
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
    return this;
  }
}
