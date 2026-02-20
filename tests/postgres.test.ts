import { describe, test, expect } from 'vitest';
import { buildQueries } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM public.users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('Postgres dialect (default)', () => {
  test('SELECT * with no filters', () => {
    const { searchQuery, params } = buildQueries(BASE, [], [], [], 0, 0, {}, []);
    expect(params).toEqual([]);
    expect(searchQuery).toContain('SELECT *');
    expect(searchQuery).not.toContain('WHERE');
    expect(searchQuery).not.toContain('ORDER BY');
    expect(searchQuery).not.toContain('LIMIT');
  });

  test('Column mapping & SELECT list with aliases', () => {
    const mapper = { id: 'u.id', name: 'u.name', createdAt: 'u.created_at' };
    const { searchQuery, params } = buildQueries(
      BASE, [], [],
      [{ key: 'createdAt', direction: 'DESC' }],
      1, 10, mapper, ['id', 'name', 'createdAt']
    );
    expect(params).toEqual([]);
    expect(searchQuery).toContain('u.id AS "id"');
    expect(searchQuery).toContain('u.created_at AS "createdAt"');
    expect(searchQuery).toContain('ORDER BY u.created_at DESC');
    expect(searchQuery).toContain('LIMIT 10 OFFSET 0');
  });

  test('WHERE with multiple operations and $N placeholders', () => {
    const mapper = { ageYears: 'u.age_years', score: 'u.score' };
    const where = [
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
      { key: 'ageYears', operation: 'GTE' as const, value: 18 },
      { key: 'score', operation: 'LT' as const, value: 100 },
      { key: 'tier', operation: 'NEQ' as const, value: 'BRONZE' },
      { key: 'height', operation: 'GT' as const, value: 150 },
      { key: 'weight', operation: 'LTE' as const, value: 80 },
    ];
    const text = [
      { key: 'name', operation: 'LIKE' as const, value: '%john%', ignoreCase: true },
      { key: 'email', operation: 'LIKE' as const, value: '%@example.com', ignoreCase: false },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, text,
      [{ key: 'score', direction: 'ASC' }],
      2, 25, mapper, ['id']
    );
    expect(params).toEqual(['%john%', '%@example.com', 'ACTIVE', 18, 100, 'BRONZE', 150, 80]);
    expect(searchQuery).toContain('LOWER("name") LIKE $1');
    expect(searchQuery).toContain('"email" LIKE $2');
    expect(searchQuery).toContain('LIMIT 25 OFFSET 25');
  });

  test('IN list builds ($n, $n+1) placeholders', () => {
    const where = [
      { key: 'role', operation: 'IN' as const, value: ['ADMIN', 'EDITOR'] },
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, [], [{ key: 'role', direction: 'ASC' }],
      1, 10, {}, ['id', 'role', 'status']
    );
    expect(params).toEqual(['ADMIN', 'EDITOR', 'ACTIVE']);
    expect(searchQuery).toContain('IN ($1, $2)');
    expect(searchQuery).toContain('= $3');
  });

  test('NULL and NOT_NULL produce no params', () => {
    const where = [
      { key: 'deleted_at', operation: 'NULL' as const },
      { key: 'verified_at', operation: 'NOT_NULL' as const },
    ];
    const { params } = buildQueries(BASE, where, [], [], 0, 0, {}, ['id', 'deleted_at', 'verified_at']);
    expect(params).toEqual([]);
  });

  test('Text search OR-group + ANDed filters', () => {
    const mapper = { createdAt: 'u.created_at', name: 'u.name' };
    const text = [
      { key: 'name', operation: 'LIKE' as const, value: '%ann%', ignoreCase: true },
      { key: 'email', operation: 'NOT_LIKE' as const, value: '%@spam.com', ignoreCase: false },
    ];
    const where = [
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
      { key: 'createdAt', operation: 'GTE' as const, value: '2024-01-01' },
    ];
    const { searchQuery, params } = buildQueries(
      BASE, where, text,
      [{ key: 'createdAt', direction: 'DESC' }],
      3, 50, mapper, ['id', 'name', 'email', 'createdAt']
    );
    expect(params).toEqual(['%ann%', '%@spam.com', 'ACTIVE', '2024-01-01']);
    expect(searchQuery).toContain('LIMIT 50 OFFSET 100');
  });

  test('DISTINCT in SELECT', () => {
    const mapper = { id: 'u.id', email: 'u.email', name: 'u.name' };
    const { searchQuery, countQuery } = buildQueries(
      BASE, [], [], [{ key: 'email', direction: 'ASC' }],
      1, 5, mapper, ['email', 'name'], true
    );
    expect(searchQuery).toContain('DISTINCT');
    expect(countQuery).toContain('COUNT(DISTINCT');
  });

  test('Parameter numbering across textSearch + where + IN', () => {
    const text = [{ key: 'name', operation: 'LIKE' as const, value: '%sam%', ignoreCase: true }];
    const where = [
      { key: 'status', operation: 'EQ' as const, value: 'ACTIVE' },
      { key: 'role', operation: 'IN' as const, value: ['ADMIN', 'EDITOR', 'AUTHOR'] },
      { key: 'age', operation: 'GT' as const, value: 21 },
    ];
    const { params } = buildQueries(BASE, where, text, [], 1, 10, {}, ['id']);
    expect(params).toEqual(['%sam%', 'ACTIVE', 'ADMIN', 'EDITOR', 'AUTHOR', 21]);
  });
});
