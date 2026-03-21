import { describe, test, expect } from 'vitest';
import { buildQueries, createDialect } from '../src';

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

  test('Unsupported operation throws error', () => {
    expect(() => {
      buildQueries(BASE, [{ key: 'x', operation: 'BETWEEN' as any, value: 1 }]);
    }).toThrow('Unsupported operation');
  });

  test('IN with empty array (documents current behavior)', () => {
    const { searchQuery, params } = buildQueries(
      BASE, [{ key: 'role', operation: 'IN', value: [] }],
      [], [], 0, 0, {}, ['id', 'role']
    );
    expect(params).toEqual([]);
    expect(searchQuery).toContain('IN ()');
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
