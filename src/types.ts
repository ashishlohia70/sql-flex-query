export type Operation =
  | "EQ"
  | "NEQ"
  | "LIKE"
  | "NOT_LIKE"
  | "GT"
  | "LT"
  | "GTE"
  | "LTE"
  | "IN"
  | "NULL"
  | "NOT_NULL"
  | "BETWEEN";

/**
 * Built-in dialect names. For custom dialects, any string is allowed.
 * Use the `registerDialect()` function to add custom dialects.
 */
export const KNOWN_DIALECTS = [
  "postgres",
  "mysql",
  "sqlite",
  "mssql",
  "oracle",
  "cockroach",
  "snowflake",
] as const;
export type DialectName = (typeof KNOWN_DIALECTS)[number] | string;

export type SortDirection = "ASC" | "DESC";

export interface Criteria {
  key: string;
  operation: Operation;
  value?: any;
  ignoreCase?: boolean;
  having?: boolean;
}

export interface SortCriteria {
  key: string;
  direction: SortDirection;
}

export interface ColumnMapper {
  [key: string]: string;
}

export interface BuildResult {
  searchQuery: string;
  countQuery: string;
  params: any[];
}

export interface BuildOptions {
  baseQueryTemplate: string;
  whereParams?: Criteria[];
  textSearchParams?: Criteria[];
  sortBy?: SortCriteria[];
  page?: number;
  size?: number;
  columnMapper?: ColumnMapper;
  selectColumns?: string[];
  distinct?: boolean;
  modifyCountQuery?: ((query: string) => string) | null;
  dialect?: DialectName;
}

export interface Dialect {
  name: DialectName;
  placeholder(position: number): string;
  quoteIdentifier(identifier: string): string;
  paginationClause(page: number, size: number): string;
  lowerFunction(column: string): string;
  lowerValue(value: string): string;
  requiresOrderByForPagination: boolean;
  mergesPaginationWithOrderBy: boolean;
  orderByWithPagination(
    orderClause: string,
    page: number,
    size: number,
  ): string;
}
