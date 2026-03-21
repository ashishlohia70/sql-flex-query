import { describe, test, expect } from 'vitest';
import { buildQueries, QueryBuilder } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('Oracle dialect', () => {
  const dialectOpt = { dialect: 'oracle' as const };

  test('Uses :1, :2 placeholders instead of $N or ?', () => {
    const where = [
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
      { key: 'age', operation: 'GT' as const, value: 18 },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual(['ACTIVE', 18]);
    expect(searchQuery).toContain('= :1');
    expect(searchQuery).toContain('> :2');
    expect(searchQuery).not.toContain('$');
    expect(searchQuery).not.toContain('?');
  });

  test('Uses double quotes for identifier quoting', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, ['name', 'email'], false, null, dialectOpt
    );
    expect(searchQuery).toContain('"name"');
    expect(searchQuery).toContain('"email"');
  });

  test('LIKE is case-sensitive by default, uses LOWER() for case-insensitive', () => {
    const text = [
      { key: 'name', operation: 'LIKE' as const, value: '%John%', ignoreCase: true },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, [], text, [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('LOWER("name") LIKE :1');
    expect(params).toEqual(['%john%']); // value is lowercased
  });

  test('IN list uses :1, :2 placeholders', () => {
    const where = [
      { key: 'role', operation: 'IN' as const, value: ['ADMIN', 'EDITOR', 'VIEWER'] },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(params).toEqual(['ADMIN', 'EDITOR', 'VIEWER']);
    expect(searchQuery).toContain('IN (:1, :2, :3)');
  });

  test('Pagination uses OFFSET/FETCH merged with ORDER BY', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [{ key: 'id', direction: 'ASC' }],
      2, 10, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('ORDER BY "id" ASC');
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

  test('NULL and NOT_NULL produce no params', () => {
    const where = [
      { key: 'deleted_at', operation: 'NULL' as const },
      { key: 'verified_at', operation: 'NOT_NULL' as const },
    ];
    const { params } = buildQueries(BASE, where, [], [], 0, 0, {}, ['id', 'deleted_at', 'verified_at']);
    expect(params).toEqual([]);
  });

  test('Fluent API with Oracle', () => {
    const result = new QueryBuilder('oracle')
      .baseQuery(BASE)
      .select(['id', 'name'])
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .orderBy({ key: 'name', direction: 'ASC' })
      .paginate(1, 10)
      .build();
    expect(result.params).toEqual(['ACTIVE']);
    expect(result.searchQuery).toContain('= :1');
    expect(result.searchQuery).toContain('OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY');
    expect(result.searchQuery).toContain('"id"');
  });
});
