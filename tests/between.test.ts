import { describe, it, expect } from 'vitest';
import { buildQueries } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('BETWEEN operation', () => {
  const testCases = [
    { dialect: 'postgres', placeholder1: '$1', placeholder2: '$2' },
    { dialect: 'mysql', placeholder1: '?', placeholder2: '?' },
    { dialect: 'sqlite', placeholder1: '?', placeholder2: '?' },
    { dialect: 'mssql', placeholder1: '@p1', placeholder2: '@p2' },
    { dialect: 'oracle', placeholder1: ':1', placeholder2: ':2' },
    { dialect: 'cockroach', placeholder1: '$1', placeholder2: '$2' },
    { dialect: 'snowflake', placeholder1: '?', placeholder2: '?' },
  ];

  testCases.forEach(({ dialect, placeholder1, placeholder2 }) => {
    it(`generates correct ${dialect} syntax for BETWEEN operation`, () => {
      const result = buildQueries({
        baseQueryTemplate: BASE,
        whereParams: [{ key: 'age', operation: 'BETWEEN', value: [18, 65] }],
        page: 1,
        size: 10,
        columnMapper: { age: 'u.age' },
        selectColumns: ['id', 'age'],
        dialect: dialect as any,
      });

      expect(result.searchQuery).toContain(`u.age >= ${placeholder1} AND u.age <= ${placeholder2}`);
      expect(result.params).toEqual([18, 65]);
    });
  });

  it('throws error when BETWEEN value is not an array', () => {
    expect(() => {
      buildQueries(BASE, [{ key: 'age', operation: 'BETWEEN', value: 18 }]);
    }).toThrow('BETWEEN operation requires an array of two values.');
  });

  it('throws error when BETWEEN array does not have exactly two values', () => {
    expect(() => {
      buildQueries(BASE, [{ key: 'age', operation: 'BETWEEN', value: [18] }]);
    }).toThrow('BETWEEN operation requires an array of two values.');
  });

  it('throws error when BETWEEN array has more than two values', () => {
    expect(() => {
      buildQueries(BASE, [{ key: 'age', operation: 'BETWEEN', value: [18, 65, 100] }]);
    }).toThrow('BETWEEN operation requires an array of two values.');
  });
});