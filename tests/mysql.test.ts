import { describe, test, expect } from 'vitest';
import { buildQueries, QueryBuilder } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('MySQL dialect', () => {
  const dialectOpt = { dialect: 'mysql' as const };

  test('Uses ? placeholders instead of $N', () => {
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
  });

  test('Uses backticks for identifier quoting', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, ['name', 'email'], false, null, dialectOpt
    );
    expect(searchQuery).toContain('`name`');
    expect(searchQuery).toContain('`email`');
  });

  test('LIKE is case-insensitive natively (no LOWER())', () => {
    const text = [
      { key: 'name', operation: 'LIKE' as const, value: '%John%', ignoreCase: true },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, [], text, [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).not.toContain('LOWER');
    expect(params).toEqual(['%John%']);
  });

  test('IN list uses ? placeholders', () => {
    const where = [
      { key: 'role', operation: 'IN' as const, value: ['ADMIN', 'EDITOR', 'VIEWER'] },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(params).toEqual(['ADMIN', 'EDITOR', 'VIEWER']);
    expect(searchQuery).toContain('IN (?, ?, ?)');
  });

  test('LIMIT/OFFSET pagination', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [{ key: 'id', direction: 'ASC' }],
      2, 10, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('LIMIT 10 OFFSET 10');
  });

  test('BETWEEN operation generates >= and <= with ? placeholders', () => {
    const where = [
      { key: 'price', operation: 'BETWEEN' as const, value: [100, 1000] },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual([100, 1000]);
    expect(searchQuery).toContain('`price` >= ? AND `price` <= ?');
  });

  test('Fluent API with MySQL', () => {
    const result = new QueryBuilder('mysql')
      .baseQuery(BASE)
      .select(['id', 'name'])
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .orderBy({ key: 'name', direction: 'ASC' })
      .paginate(1, 10)
      .build();
    expect(result.params).toEqual(['ACTIVE']);
    expect(result.searchQuery).toContain('= ?');
    expect(result.searchQuery).toContain('LIMIT 10 OFFSET 0');
    expect(result.searchQuery).toContain('`id`');
  });
});
