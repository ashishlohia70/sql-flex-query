import { describe, test, expect } from 'vitest';
import { buildQueries, QueryBuilder } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/ /*LIMIT_CLAUSE*/
`;

describe('MSSQL dialect', () => {
  const dialectOpt = { dialect: 'mssql' as const };

  test('Uses @p1, @p2 placeholders', () => {
    const where = [
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
      { key: 'age', operation: 'GT' as const, value: 18 },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [{ key: 'id', direction: 'ASC' }],
      1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual(['ACTIVE', 18]);
    expect(searchQuery).toContain('= @p1');
    expect(searchQuery).toContain('> @p2');
  });

  test('Uses [brackets] for identifier quoting', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, ['name', 'email'], false, null, dialectOpt
    );
    expect(searchQuery).toContain('[name]');
    expect(searchQuery).toContain('[email]');
  });

  test('Pagination uses OFFSET...FETCH merged with ORDER BY', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [],
      [{ key: 'id', direction: 'ASC' }],
      2, 10, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('ORDER BY [id] ASC');
    expect(searchQuery).toContain('OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY');
    expect(searchQuery).not.toContain('LIMIT');
  });

  test('Pagination without ORDER BY injects ORDER BY (SELECT NULL)', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 1, 10, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('ORDER BY (SELECT NULL)');
    expect(searchQuery).toContain('OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY');
  });

  test('No pagination = no ORDER BY injected', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).not.toContain('ORDER BY');
    expect(searchQuery).not.toContain('OFFSET');
  });

  test('Count query has no ORDER BY or pagination', () => {
    const { countQuery } = buildQueries(
      BASE, [], [],
      [{ key: 'id', direction: 'ASC' }],
      1, 10, {}, [], false, null, dialectOpt
    );
    expect(countQuery).not.toContain('ORDER BY');
    expect(countQuery).not.toContain('OFFSET');
    expect(countQuery).toContain('COUNT');
  });

  test('BETWEEN operation generates >= and < with @pN placeholders', () => {
    const where = [
      { key: 'score', operation: 'BETWEEN' as const, value: [50, 100] },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual([50, 100]);
    expect(searchQuery).toContain('[score] >= @p1 AND [score] < @p2');
  });

  test('Fluent API with MSSQL', () => {
    const result = new QueryBuilder('mssql')
      .baseQuery(BASE)
      .select(['id', 'name'])
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .sortBy('id', 'ASC')
      .paginate(1, 10)
      .build();
    expect(result.searchQuery).toContain('= @p1');
    expect(result.searchQuery).toContain('OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY');
    expect(result.searchQuery).toContain('[id]');
  });
});
