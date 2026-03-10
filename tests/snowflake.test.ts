import { describe, test, expect } from 'vitest';
import { buildQueries, QueryBuilder } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('Snowflake dialect', () => {
  const dialectOpt = { dialect: 'snowflake' as const };

  test('Uses ? placeholders', () => {
    const where = [
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
      { key: 'age', operation: 'GT' as const, value: 18 },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual(['ACTIVE', 18]);
    expect(searchQuery).toContain('= ?');
    expect(searchQuery).toContain('> ?');
    expect(searchQuery).not.toContain('$');
    expect(searchQuery).not.toContain(':');
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
    expect(searchQuery).toContain('LOWER("name") LIKE ?');
    expect(params).toEqual(['%john%']); // value is lowercased
  });

  test('IN list uses ?, ?, ? placeholders', () => {
    const where = [
      { key: 'role', operation: 'IN' as const, value: ['ADMIN', 'EDITOR', 'VIEWER'] },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(params).toEqual(['ADMIN', 'EDITOR', 'VIEWER']);
    expect(searchQuery).toContain('IN (?, ?, ?)');
  });

  test('Pagination uses LIMIT/OFFSET', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [{ key: 'id', direction: 'ASC' }],
      2, 10, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('ORDER BY "id" ASC');
    expect(searchQuery).toContain('LIMIT 10 OFFSET 10');
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

  test('Fluent API with Snowflake', () => {
    const result = new QueryBuilder('snowflake')
      .baseQuery(BASE)
      .select(['id', 'name'])
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .orderBy({ key: 'created_at', direction: 'DESC' })
      .paginate(1, 20)
      .build();
    expect(result.params).toEqual(['ACTIVE']);
    expect(result.searchQuery).toContain('= ?');
    expect(result.searchQuery).toContain('LIMIT 20 OFFSET 0');
    expect(result.searchQuery).toContain('"id"');
  });
});
