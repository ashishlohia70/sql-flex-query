import { Criteria, SortCriteria, ColumnMapper, Dialect } from "../types";
import { getKey } from "../utils/helpers";

export function prepareClause(
  criteria: Criteria,
  params: any[],
  columnMapper: ColumnMapper,
  dialect: Dialect,
): string {
  const key = getKey(columnMapper, criteria.key, dialect);
  const operation = criteria.operation.toUpperCase();
  const value = criteria.value;
  const ignoreCase = criteria.ignoreCase || false;

  switch (operation) {
    case "EQ":
      params.push(value);
      return `${key} = ${dialect.placeholder(params.length)}`;
    case "NEQ":
      params.push(value);
      return `${key} <> ${dialect.placeholder(params.length)}`;
    case "LIKE": {
      params.push(ignoreCase ? dialect.lowerValue(value) : value);
      const col = ignoreCase ? dialect.lowerFunction(key) : key;
      return `${col} LIKE ${dialect.placeholder(params.length)}`;
    }
    case "NOT_LIKE": {
      params.push(ignoreCase ? dialect.lowerValue(value) : value);
      const col = ignoreCase ? dialect.lowerFunction(key) : key;
      return `${col} NOT LIKE ${dialect.placeholder(params.length)}`;
    }
    case "GT":
      params.push(value);
      return `${key} > ${dialect.placeholder(params.length)}`;
    case "LT":
      params.push(value);
      return `${key} < ${dialect.placeholder(params.length)}`;
    case "GTE":
      params.push(value);
      return `${key} >= ${dialect.placeholder(params.length)}`;
    case "LTE":
      params.push(value);
      return `${key} <= ${dialect.placeholder(params.length)}`;
    case "IN": {
      const values = value as any[];
      const placeholders = values
        .map((_, i) => dialect.placeholder(params.length + i + 1))
        .join(", ");
      params.push(...values);
      return `${key} IN (${placeholders})`;
    }
    case "NULL":
      return `${key} IS NULL`;
    case "NOT_NULL":
      return `${key} IS NOT NULL`;
    case "BETWEEN": {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error(`BETWEEN operation requires an array of two values.`);
      }
      params.push(value[0], value[1]);
      return `${key} >= ${dialect.placeholder(params.length - 1)} AND ${key} < ${dialect.placeholder(params.length)}`;
    }
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

export function prepareWhereClause(
  whereParams: Criteria[],
  textSearchParams: Criteria[],
  params: any[],
  columnMapper: ColumnMapper,
  dialect: Dialect,
): string {
  const clauses: string[] = [];

  if (textSearchParams.length > 0) {
    const orGroup = textSearchParams
      .map((c) => prepareClause(c, params, columnMapper, dialect))
      .join(" OR ");
    clauses.push(`(${orGroup})`);
  }

  for (const criteria of whereParams) {
    const clause = prepareClause(criteria, params, columnMapper, dialect);
    clauses.push(clause);
  }

  return clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
}

export function prepareHavingClause(
  havingParams: Criteria[],
  params: any[],
  columnMapper: ColumnMapper,
  dialect: Dialect,
): string {
  const clauses: string[] = [];
  for (const criteria of havingParams) {
    const clause = prepareClause(criteria, params, columnMapper, dialect);
    clauses.push(clause);
  }
  return clauses.length > 0 ? ` HAVING ${clauses.join(" AND ")}` : "";
}

function addQuotesIfMissingForSelect(str: string, dialect: Dialect): string {
  if (
    str.includes(".") ||
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("`") && str.endsWith("`")) ||
    (str.startsWith("[") && str.endsWith("]"))
  ) {
    return str;
  }
  return dialect.quoteIdentifier(str);
}

export function prepareSelect(
  columnMapper: ColumnMapper,
  selectColumns: string[],
  distinct: boolean,
  dialect: Dialect,
): string {
  const columns =
    selectColumns.length > 0
      ? selectColumns
          .map((col) => {
            const actualCol = columnMapper[col] || col;
            return columnMapper[col]
              ? `${actualCol} AS ${dialect.quoteIdentifier(col)}`
              : addQuotesIfMissingForSelect(actualCol, dialect);
          })
          .join(", ")
      : "*";

  return distinct ? `DISTINCT ${columns}` : columns;
}

export function prepareOrderClause(
  sortBy: SortCriteria[],
  columnMapper: ColumnMapper,
  dialect: Dialect,
): string {
  return sortBy.length > 0
    ? "ORDER BY " +
        sortBy
          .map((s) => `${getKey(columnMapper, s.key, dialect)} ${s.direction}`)
          .join(", ")
    : "";
}
