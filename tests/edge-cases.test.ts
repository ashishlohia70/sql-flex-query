import { describe, test, expect } from 'vitest';
import { buildQueries, createDialect, dialectHelpers } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('Edge cases', () => {
  test('Unsupported dialect throws error', () => {
    expect(() => {
      createDialect('unsupported' as any);
    }).toThrow('Unsupported dialect');
  });

  test('BETWEEN operation validates input correctly', () => {
    expect(() => {
      buildQueries(BASE, [{ key: 'x', operation: 'BETWEEN' as any, value: 1 }]);
    }).toThrow('BETWEEN operation requires an array of two values.');
  });

  describe('IN with an empty array matches nothing (no invalid `IN ()`)', () => {
    const DIALECTS = ['postgres', 'mysql', 'sqlite', 'mssql', 'oracle', 'cockroach', 'snowflake'];
    const NEXT_PLACEHOLDER: Record<string, string> = {
      postgres: '$1', mysql: '?', sqlite: '?', mssql: '@p1', oracle: ':1', cockroach: '$1', snowflake: '?',
    };

    test.each(DIALECTS)('%s: emits 1 = 0, pushes no params, keeps later placeholders aligned', (dialect) => {
      const { searchQuery, countQuery, params } = buildQueries({
        baseQueryTemplate: BASE,
        whereParams: [
          { key: 'role', operation: 'IN', value: [] },
          { key: 'status', operation: 'EQ', value: 'ACTIVE' },
        ],
        dialect,
      });
      expect(searchQuery).not.toContain('IN (');
      expect(searchQuery).toContain(`WHERE 1 = 0 AND `);
      expect(searchQuery).toContain(`= ${NEXT_PLACEHOLDER[dialect]}`);
      expect(countQuery).toContain('WHERE 1 = 0 AND ');
      expect(params).toEqual(['ACTIVE']);
    });

    test('inside a text-search OR group it contributes nothing', () => {
      const { searchQuery, params } = buildQueries({
        baseQueryTemplate: BASE,
        textSearchParams: [
          { key: 'role', operation: 'IN', value: [] },
          { key: 'name', operation: 'LIKE', value: '%jo%' },
        ],
      });
      expect(searchQuery).toContain('WHERE (1 = 0 OR "name" LIKE $1)');
      expect(params).toEqual(['%jo%']);
    });

    test('in HAVING', () => {
      const { searchQuery } = buildQueries({
        baseQueryTemplate: `SELECT /*SELECT_COLUMNS*/ FROM t /*WHERE_CLAUSE*/ GROUP BY g /*HAVING_CLAUSE*/`,
        whereParams: [{ key: 'g', operation: 'IN', value: [], having: true }],
      });
      expect(searchQuery).toContain('HAVING 1 = 0');
    });

    test('dialectHelpers: an empty-list DELETE/UPDATE condition matches nothing', () => {
      const h = dialectHelpers('postgres');
      const { setClause, params } = h.buildSetClause({ status: 'ARCHIVED' });
      const { clause } = h.buildWhereClause(
        [{ key: 'id', operation: 'IN', value: [] }, { key: 'tenant', operation: 'EQ', value: 7 }],
        [], {}, params
      );
      expect(`UPDATE t SET ${setClause}${clause}`).toBe(
        'UPDATE t SET "status" = $1 WHERE 1 = 0 AND "tenant" = $2'
      );
      expect(params).toEqual(['ARCHIVED', 7]);
      expect(h.buildClause({ key: 'id', operation: 'IN', value: [] }, [])).toBe('1 = 0');
    });

    test('non-empty IN is unchanged', () => {
      const { searchQuery, params } = buildQueries({
        baseQueryTemplate: BASE,
        whereParams: [{ key: 'role', operation: 'IN', value: ['A', 'B'] }],
        dialect: 'mssql',
      });
      expect(searchQuery).toContain('[role] IN (@p1, @p2)');
      expect(params).toEqual(['A', 'B']);
    });
  });

  test('IN with a non-array value throws a clear error', () => {
    for (const value of [undefined, null, 'ADMIN', 5, { a: 1 }]) {
      expect(() => buildQueries(BASE, [{ key: 'role', operation: 'IN', value }])).toThrow(
        'IN operation requires an array of values.'
      );
    }
  });

  test('Options object API works', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      whereParams: [{ key: 'status', operation: 'EQ', value: 'ACTIVE' }],
      dialect: 'mysql',
      page: 1,
      size: 10,
    });
    expect(result.params).toEqual(['ACTIVE']);
    expect(result.searchQuery).toContain('= ?');
    expect(result.searchQuery).toContain('LIMIT 10 OFFSET 0');
  });

  test('Default dialect is postgres', () => {
    const { searchQuery } = buildQueries(
      BASE, [{ key: 'x', operation: 'EQ', value: 1 }]
    );
    expect(searchQuery).toContain('$1');
  });

  test('modifyCountQuery callback works', () => {
    const { countQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, [], false,
      (q) => `SELECT COUNT(*) AS count FROM (${q}) t`
    );
    expect(countQuery).toContain('SELECT COUNT(*) AS count FROM (');
  });
});
