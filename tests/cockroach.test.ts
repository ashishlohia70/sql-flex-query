import { describe, test, expect } from 'vitest';
import { buildQueries, QueryBuilder } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('CockroachDB dialect', () => {
  const dialectOpt = { dialect: 'cockroach' as const };

  test('Uses $1, $2 placeholders (PostgreSQL-compatible)', () => {
    const where = [
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
      { key: 'age', operation: 'GT' as const, value: 18 },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual(['ACTIVE', 18]);
    expect(searchQuery).toContain('= $1');
    expect(searchQuery).toContain('> $2');
  });

  test('Uses double quotes for identifier quoting', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, ['name', 'email'], false, null, dialectOpt
    );
    expect(searchQuery).toContain('"name"');
    expect(searchQuery).toContain('"email"');
  });

  test('LIKE uses LOWER() for case-insensitive search', () => {
    const text = [
      { key: 'name', operation: 'LIKE' as const, value: '%John%', ignoreCase: true },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, [], text, [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('LOWER("name") LIKE $1');
    expect(params).toEqual(['%john%']); // value is lowercased
  });

  test('IN list uses $1, $2 placeholders', () => {
    const where = [
      { key: 'role', operation: 'IN' as const, value: ['ADMIN', 'EDITOR'] },
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(params).toEqual(['ADMIN', 'EDITOR', 'ACTIVE']);
    expect(searchQuery).toContain('IN ($1, $2)');
    expect(searchQuery).toContain('= $3');
  });

  test('Pagination uses LIMIT/OFFSET', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [{ key: 'id', direction: 'ASC' }],
      2, 25, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('ORDER BY "id" ASC');
    expect(searchQuery).toContain('LIMIT 25 OFFSET 25');
  });

  test('No pagination does not add LIMIT', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).not.toContain('LIMIT');
    expect(searchQuery).not.toContain('OFFSET');
  });

  test('Count query excludes ORDER BY and LIMIT', () => {
    const { countQuery } = buildQueries(
      BASE, [], [],
      [{ key: 'id', direction: 'ASC' }],
      1, 10, {}, [], false, null, dialectOpt
    );
    expect(countQuery).not.toContain('ORDER BY');
    expect(countQuery).not.toContain('LIMIT');
    expect(countQuery).toContain('COUNT');
  });

  test('BETWEEN operation generates >= and < with $N placeholders', () => {
    const where = [
      { key: 'rating', operation: 'BETWEEN' as const, value: [3, 5] },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual([3, 5]);
    expect(searchQuery).toContain('"rating" >= $1 AND "rating" < $2');
  });

  test('Fluent API with CockroachDB', () => {
    const result = new QueryBuilder('cockroach')
      .baseQuery(BASE)
      .select(['id', 'name'])
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .orderBy({ key: 'name', direction: 'DESC' })
      .paginate(1, 15)
      .build();
    expect(result.params).toEqual(['ACTIVE']);
    expect(result.searchQuery).toContain('= $1');
    expect(result.searchQuery).toContain('LIMIT 15 OFFSET 0');
    expect(result.searchQuery).toContain('"id"');
  });
});
