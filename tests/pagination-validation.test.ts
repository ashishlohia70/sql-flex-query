import { describe, test, expect } from 'vitest';
import {
  buildQueries,
  QueryBuilder,
  dialectHelpers,
  createDialect,
  registerDialect,
  BaseDialect,
  type DialectName,
} from '../src';

const BASE = `SELECT /*SELECT_COLUMNS*/ FROM users /*WHERE_CLAUSE*/ /*ORDER_BY*/ /*LIMIT_CLAUSE*/`;
const DIALECTS = ['postgres', 'mysql', 'sqlite', 'mssql', 'oracle', 'cockroach', 'snowflake'];
const INJECTION = '1; DROP TABLE users; --';

const build = (page: unknown, size: unknown, dialect = 'postgres') =>
  buildQueries({
    baseQueryTemplate: BASE,
    sortBy: [{ key: 'id', direction: 'ASC' }],
    page: page as number,
    size: size as number,
    dialect,
  });

describe('Pagination input validation (LIMIT/OFFSET injection)', () => {
  describe.each(DIALECTS)('%s', (dialect) => {
    test('rejects SQL in size or page', () => {
      expect(() => build(1, INJECTION, dialect)).toThrow('Invalid size');
      expect(() => build(INJECTION, 10, dialect)).toThrow('Invalid page');
    });

    test('rejects negative and fractional values', () => {
      expect(() => build(1, -1, dialect)).toThrow('Invalid size');
      expect(() => build(-2, 10, dialect)).toThrow('Invalid page');
      expect(() => build(1, 2.5, dialect)).toThrow('Invalid size');
      expect(() => build(1.5, 10, dialect)).toThrow('Invalid page');
    });

    test('direct dialect use is protected too', () => {
      const d = createDialect(dialect);
      expect(() => d.paginationClause(1, INJECTION as any)).toThrow('Invalid size');
      expect(() => d.orderByWithPagination('ORDER BY id', INJECTION as any, 10)).toThrow('Invalid page');
    });
  });

  test('rejects other non-numeric types', () => {
    for (const bad of [true, {}, [10], ['1'], 10n, Infinity, '1e3', '0x10', ' 10', '10 ']) {
      expect(() => build(1, bad)).toThrow('Invalid size');
    }
  });

  test('rejects integers beyond the safe range', () => {
    expect(() => build(1, Number.MAX_SAFE_INTEGER + 1)).toThrow('Invalid size');
    expect(() => build(1, '99999999999999999999')).toThrow('Invalid size');
  });

  test('error message truncates long input', () => {
    expect(() => build(1, 'x'.repeat(500))).toThrow(/received "x{32}\.\.\."\.$/);
  });

  test('digit-only strings (e.g. from req.query) are coerced to numbers', () => {
    expect(build('3', '20').searchQuery).toContain('LIMIT 20 OFFSET 40');
    expect(build('3', '20', 'mssql').searchQuery).toContain('OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY');
  });

  test('falsy values still mean "no pagination" (backward compatible)', () => {
    for (const empty of [0, null, undefined, NaN, '']) {
      const r = buildQueries(BASE, [], [], [], empty as number, 10);
      expect(r.searchQuery).not.toContain('LIMIT');
    }
    // options form keeps its size default of 10
    expect(build(1, NaN).searchQuery).toContain('LIMIT 10 OFFSET 0');
    expect(build(1, 0, 'oracle').searchQuery).toContain('FETCH NEXT 10 ROWS ONLY');
  });

  test('QueryBuilder.paginate() is protected', () => {
    const qb = () => new QueryBuilder('mssql').baseQuery(BASE).sortBy('id');
    expect(() => qb().paginate(1, INJECTION as any).build()).toThrow('Invalid size');
    expect(qb().paginate('2' as any, '5' as any).build().searchQuery).toContain(
      'OFFSET 5 ROWS FETCH NEXT 5 ROWS ONLY',
    );
  });

  test('dialectHelpers().paginationClause() is protected', () => {
    for (const dialect of DIALECTS) {
      expect(() => dialectHelpers(dialect).paginationClause(1, INJECTION as any)).toThrow('Invalid size');
    }
    expect(dialectHelpers('postgres').paginationClause('2' as any, 10)).toBe('LIMIT 10 OFFSET 10');
  });

  test('custom dialects that interpolate raw values are protected via buildQueries/dialectHelpers', () => {
    class NaiveDialect extends BaseDialect {
      name: DialectName = 'naive-pagination';
      placeholder(p: number) {
        return `$${p}`;
      }
      quoteIdentifier(id: string) {
        return `"${id}"`;
      }
      paginationClause(page: number, size: number) {
        return page && size ? `LIMIT ${size} OFFSET ${(page - 1) * size}` : '';
      }
    }
    registerDialect('naive-pagination', () => new NaiveDialect());

    expect(() => build(1, INJECTION, 'naive-pagination')).toThrow('Invalid size');
    expect(() => dialectHelpers('naive-pagination').paginationClause(1, INJECTION as any)).toThrow(
      'Invalid size',
    );
    expect(build('2', '10', 'naive-pagination').searchQuery).toContain('LIMIT 10 OFFSET 10');
  });
});
