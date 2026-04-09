import { describe, test, expect } from 'vitest';
import { buildQueries } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('SQLite dialect', () => {
  const dialectOpt = { dialect: 'sqlite' as const };

  test('Uses ? placeholders', () => {
    const where = [{ key: 'status', operation: 'EQ' as const, value: 'ACTIVE' }];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(params).toEqual(['ACTIVE']);
    expect(searchQuery).toContain('= ?');
    expect(searchQuery).not.toContain('$');
  });

  test('Uses double quotes for identifiers', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [], 0, 0, {}, ['name'], false, null, dialectOpt
    );
    expect(searchQuery).toContain('"name"');
  });

  test('Uses LOWER() for case-insensitive LIKE', () => {
    const text = [
      { key: 'name', operation: 'LIKE' as const, value: '%John%', ignoreCase: true },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, [], text, [], 0, 0, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('LOWER("name") LIKE ?');
    expect(params).toEqual(['%john%']);
  });

  test('BETWEEN operation generates >= and < with ? placeholders', () => {
    const where = [
      { key: 'score', operation: 'BETWEEN' as const, value: [0, 100] },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [], 1, 10, {}, ['id'], false, null, dialectOpt
    );
    expect(params).toEqual([0, 100]);
    expect(searchQuery).toContain('"score" >= ? AND "score" < ?');
  });

  test('LIMIT/OFFSET pagination', () => {
    const { searchQuery } = buildQueries(
      BASE, [], [], [{ key: 'id', direction: 'ASC' }],
      3, 20, {}, [], false, null, dialectOpt
    );
    expect(searchQuery).toContain('LIMIT 20 OFFSET 40');
  });
});
