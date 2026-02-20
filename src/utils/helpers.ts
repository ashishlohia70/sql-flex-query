import { Dialect } from '../types';

export function addQuotesIfMissing(str: string, dialect: Dialect): string {
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith('`') && str.endsWith('`')) ||
    (str.startsWith('[') && str.endsWith(']'))
  ) {
    return str;
  }
  if (str.includes('.')) {
    return str;
  }
  return dialect.quoteIdentifier(str);
}

export function getKey(
  columnMapper: { [key: string]: string },
  key: string,
  dialect: Dialect
): string {
  return columnMapper[key] || addQuotesIfMissing(key, dialect);
}
