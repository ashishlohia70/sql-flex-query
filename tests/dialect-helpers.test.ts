import { describe, test, expect } from 'vitest';
import { dialectHelpers } from '../src';

describe('dialectHelpers', () => {

  // =============================================
  // PLACEHOLDER TESTS
  // =============================================
  describe('placeholder()', () => {
    test('Postgres uses $1, $2', () => {
      const h = dialectHelpers('postgres');
      expect(h.placeholder(1)).toBe('$1');
      expect(h.placeholder(5)).toBe('$5');
    });

    test('MySQL uses ?', () => {
      const h = dialectHelpers('mysql');
      expect(h.placeholder(1)).toBe('?');
      expect(h.placeholder(99)).toBe('?');
    });

    test('SQLite uses ?', () => {
      const h = dialectHelpers('sqlite');
      expect(h.placeholder(1)).toBe('?');
      expect(h.placeholder(10)).toBe('?');
    });

    test('MSSQL uses @p1, @p2', () => {
      const h = dialectHelpers('mssql');
      expect(h.placeholder(1)).toBe('@p1');
      expect(h.placeholder(3)).toBe('@p3');
    });
  });

  // =============================================
  // QUOTE IDENTIFIER TESTS
  // =============================================
  describe('quoteIdentifier()', () => {
    test('Postgres uses "double quotes"', () => {
      const h = dialectHelpers('postgres');
      expect(h.quoteIdentifier('name')).toBe('"name"');
    });

    test('MySQL uses backticks', () => {
      const h = dialectHelpers('mysql');
      expect(h.quoteIdentifier('name')).toBe('`name`');
    });

    test('SQLite uses "double quotes"', () => {
      const h = dialectHelpers('sqlite');
      expect(h.quoteIdentifier('name')).toBe('"name"');
    });

    test('MSSQL uses [brackets]', () => {
      const h = dialectHelpers('mssql');
      expect(h.quoteIdentifier('name')).toBe('[name]');
    });
  });

  // =============================================
  // getKey TESTS
  // =============================================
  describe('getKey()', () => {
    test('Returns mapped value if exists', () => {
      const h = dialectHelpers('postgres');
      const mapper = { firstName: 'u.first_name' };
      expect(h.getKey(mapper, 'firstName')).toBe('u.first_name');
    });

    test('Quotes unmapped key', () => {
      const h = dialectHelpers('postgres');
      expect(h.getKey({}, 'name')).toBe('"name"');
    });

    test('MySQL quotes unmapped key with backticks', () => {
      const h = dialectHelpers('mysql');
      expect(h.getKey({}, 'name')).toBe('`name`');
    });
  });

  // =============================================
  // buildInsertValues TESTS
  // =============================================
  describe('buildInsertValues()', () => {
    test('Postgres: builds columns, $1/$2 placeholders, and params', () => {
      const h = dialectHelpers('postgres');
      const mapper = { name: 'u.name', email: 'u.email', age: 'u.age' };

      const { columns, placeholders, params } = h.buildInsertValues(
        { name: 'John', email: 'john@test.com', age: 30 },
        mapper
      );

      expect(columns).toEqual(['u.name', 'u.email', 'u.age']);
      expect(placeholders).toEqual(['$1', '$2', '$3']);
      expect(params).toEqual(['John', 'john@test.com', 30]);
    });

    test('MySQL: builds columns, ? placeholders, and params', () => {
      const h = dialectHelpers('mysql');
      const mapper = { name: 'u.name', email: 'u.email' };

      const { columns, placeholders, params } = h.buildInsertValues(
        { name: 'Jane', email: 'jane@test.com' },
        mapper
      );

      expect(columns).toEqual(['u.name', 'u.email']);
      expect(placeholders).toEqual(['?', '?']);
      expect(params).toEqual(['Jane', 'jane@test.com']);
    });

    test('MSSQL: uses @p1, @p2 placeholders', () => {
      const h = dialectHelpers('mssql');

      const { placeholders, params } = h.buildInsertValues(
        { name: 'Bob', status: 'ACTIVE' },
        {}
      );

      expect(placeholders).toEqual(['@p1', '@p2']);
      expect(params).toEqual(['Bob', 'ACTIVE']);
    });

    test('Without mapper, quotes column names', () => {
      const h = dialectHelpers('postgres');

      const { columns } = h.buildInsertValues(
        { first_name: 'John', last_name: 'Doe' },
        {}
      );

      expect(columns).toEqual(['"first_name"', '"last_name"']);
    });
  });

  // =============================================
  // buildSetClause TESTS
  // =============================================
  describe('buildSetClause()', () => {
    test('Postgres: builds SET clause with $1, $2', () => {
      const h = dialectHelpers('postgres');
      const mapper = { name: 'u.name', email: 'u.email' };

      const { setClause, params, nextPosition } = h.buildSetClause(
        { name: 'Jane', email: 'jane@test.com' },
        mapper
      );

      expect(setClause).toBe('u.name = $1, u.email = $2');
      expect(params).toEqual(['Jane', 'jane@test.com']);
      expect(nextPosition).toBe(3);
    });

    test('MySQL: builds SET clause with ?', () => {
      const h = dialectHelpers('mysql');

      const { setClause, params } = h.buildSetClause(
        { name: 'Jane', status: 'INACTIVE' },
        {}
      );

      expect(setClause).toBe('`name` = ?, `status` = ?');
      expect(params).toEqual(['Jane', 'INACTIVE']);
    });

    test('MSSQL: builds SET clause with @p1, @p2', () => {
      const h = dialectHelpers('mssql');

      const { setClause, params, nextPosition } = h.buildSetClause(
        { name: 'Bob', age: 25 },
        {}
      );

      expect(setClause).toBe('[name] = @p1, [age] = @p2');
      expect(params).toEqual(['Bob', 25]);
      expect(nextPosition).toBe(3);
    });

    test('Custom startPosition works', () => {
      const h = dialectHelpers('postgres');

      const { setClause, params, nextPosition } = h.buildSetClause(
        { name: 'Jane', email: 'jane@test.com' },
        {},
        5  // start at $5
      );

      expect(setClause).toBe('"name" = $5, "email" = $6');
      expect(params).toEqual(['Jane', 'jane@test.com']);
      expect(nextPosition).toBe(7);
    });
  });

  // =============================================
  // buildWhereClause TESTS
  // =============================================
  describe('buildWhereClause()', () => {
    test('Postgres: builds WHERE with $1, $2', () => {
      const h = dialectHelpers('postgres');

      const { clause, params } = h.buildWhereClause(
        [
          { key: 'status', operation: 'EQ', value: 'ACTIVE' },
          { key: 'age', operation: 'GTE', value: 18 },
        ],
        [],
        { status: 'u.status', age: 'u.age' }
      );

      expect(clause).toBe(' WHERE u.status = $1 AND u.age >= $2');
      expect(params).toEqual(['ACTIVE', 18]);
    });

    test('MySQL: builds WHERE with ?', () => {
      const h = dialectHelpers('mysql');

      const { clause, params } = h.buildWhereClause(
        [{ key: 'id', operation: 'EQ', value: 42 }]
      );

      expect(clause).toBe(' WHERE `id` = ?');
      expect(params).toEqual([42]);
    });

    test('With text search OR group', () => {
      const h = dialectHelpers('postgres');

      const { clause, params } = h.buildWhereClause(
        [{ key: 'status', operation: 'EQ', value: 'ACTIVE' }],
        [
          { key: 'name', operation: 'LIKE', value: '%john%', ignoreCase: true },
          { key: 'email', operation: 'LIKE', value: '%john%', ignoreCase: true },
        ],
        { name: 'u.name', email: 'u.email', status: 'u.status' }
      );

      expect(clause).toContain('(LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $2)');
      expect(clause).toContain('AND u.status = $3');
      expect(params).toEqual(['%john%', '%john%', 'ACTIVE']);
    });

    test('Empty criteria returns empty string', () => {
      const h = dialectHelpers('postgres');
      const { clause, params } = h.buildWhereClause([], []);
      expect(clause).toBe('');
      expect(params).toEqual([]);
    });

    test('existingParams: placeholders continue from existing array', () => {
      const h = dialectHelpers('postgres');
      const existingParams = ['Jane', 'jane@test.com']; // from SET clause ($1, $2)

      const { clause, params } = h.buildWhereClause(
        [{ key: 'id', operation: 'EQ', value: 42 }],
        [],
        { id: 'u.id' },
        existingParams
      );

      expect(clause).toBe(' WHERE u.id = $3');
      expect(params).toBe(existingParams); // same reference
      expect(params).toEqual(['Jane', 'jane@test.com', 42]);
    });

    test('existingParams: MSSQL continues with @p3', () => {
      const h = dialectHelpers('mssql');
      const existingParams = ['Bob', 'ACTIVE']; // from SET clause (@p1, @p2)

      const { clause, params } = h.buildWhereClause(
        [{ key: 'id', operation: 'EQ', value: 7 }],
        [],
        {},
        existingParams
      );

      expect(clause).toBe(' WHERE [id] = @p3');
      expect(params).toEqual(['Bob', 'ACTIVE', 7]);
    });

    test('existingParams: complex WHERE with multiple criteria after SET', () => {
      const h = dialectHelpers('postgres');
      const mapper = { status: 'u.status', role: 'u.role', age: 'u.age' };
      const existingParams = ['INACTIVE']; // from SET clause ($1)

      const { clause, params } = h.buildWhereClause(
        [
          { key: 'role', operation: 'IN', value: ['GUEST', 'TRIAL'] },
          { key: 'age', operation: 'GTE', value: 18 },
        ],
        [],
        mapper,
        existingParams
      );

      expect(clause).toBe(' WHERE u.role IN ($2, $3) AND u.age >= $4');
      expect(params).toEqual(['INACTIVE', 'GUEST', 'TRIAL', 18]);
    });
  });

  // =============================================
  // buildClause TESTS
  // =============================================
  describe('buildClause()', () => {
    test('Postgres: builds single EQ clause', () => {
      const h = dialectHelpers('postgres');
      const params: any[] = [];

      const clause = h.buildClause(
        { key: 'status', operation: 'EQ', value: 'ACTIVE' },
        params,
        { status: 'u.status' }
      );

      expect(clause).toBe('u.status = $1');
      expect(params).toEqual(['ACTIVE']);
    });

    test('IN list with multiple values', () => {
      const h = dialectHelpers('postgres');
      const params: any[] = [];

      const clause = h.buildClause(
        { key: 'role', operation: 'IN', value: ['ADMIN', 'EDITOR'] },
        params,
        {}
      );

      expect(clause).toBe('"role" IN ($1, $2)');
      expect(params).toEqual(['ADMIN', 'EDITOR']);
    });

    test('NULL produces no params', () => {
      const h = dialectHelpers('postgres');
      const params: any[] = [];

      const clause = h.buildClause(
        { key: 'deleted_at', operation: 'NULL' },
        params,
        {}
      );

      expect(clause).toBe('"deleted_at" IS NULL');
      expect(params).toEqual([]);
    });
  });

  // =============================================
  // FULL INSERT/UPDATE INTEGRATION TESTS
  // =============================================
  describe('INSERT query integration', () => {
    test('Postgres: full INSERT query construction', () => {
      const h = dialectHelpers('postgres');
      const mapper = { name: 'u.name', email: 'u.email' };

      const { columns, placeholders, params } = h.buildInsertValues(
        { name: 'John', email: 'john@example.com' },
        mapper
      );

      const query = `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

      expect(query).toBe('INSERT INTO users (u.name, u.email) VALUES ($1, $2) RETURNING *');
      expect(params).toEqual(['John', 'john@example.com']);
    });
  });

  describe('UPDATE query integration', () => {
    test('Postgres: UPDATE with buildWhereClause (same pattern as SELECT)', () => {
      const h = dialectHelpers('postgres');
      const mapper = { name: 'u.name', email: 'u.email', id: 'u.id' };

      const { setClause, params } = h.buildSetClause(
        { name: 'Jane', email: 'jane@example.com' },
        mapper
      );

      // Pass SET params so WHERE placeholders continue from $3
      const { clause } = h.buildWhereClause(
        [{ key: 'id', operation: 'EQ', value: 42 }],
        [], mapper, params
      );

      const query = `UPDATE users SET ${setClause}${clause} RETURNING *`;

      expect(query).toBe('UPDATE users SET u.name = $1, u.email = $2 WHERE u.id = $3 RETURNING *');
      expect(params).toEqual(['Jane', 'jane@example.com', 42]);
    });

    test('MSSQL: UPDATE with buildWhereClause', () => {
      const h = dialectHelpers('mssql');
      const mapper = { name: 'u.name', status: 'u.status', id: 'u.id' };

      const { setClause, params } = h.buildSetClause(
        { name: 'Bob', status: 'ACTIVE' },
        mapper
      );

      const { clause } = h.buildWhereClause(
        [{ key: 'id', operation: 'EQ', value: 7 }],
        [], mapper, params
      );

      const query = `UPDATE users SET ${setClause}${clause}`;

      expect(query).toBe('UPDATE users SET u.name = @p1, u.status = @p2 WHERE u.id = @p3');
      expect(params).toEqual(['Bob', 'ACTIVE', 7]);
    });

    test('Postgres: UPDATE with complex WHERE using buildWhereClause', () => {
      const h = dialectHelpers('postgres');
      const mapper = { status: 'u.status', role: 'u.role', lastLogin: 'u.last_login' };

      const { setClause, params } = h.buildSetClause(
        { status: 'INACTIVE' },
        mapper
      );

      const { clause } = h.buildWhereClause(
        [
          { key: 'role', operation: 'IN', value: ['GUEST', 'TRIAL'] },
          { key: 'lastLogin', operation: 'LTE', value: '2023-01-01' },
        ],
        [], mapper, params
      );

      const query = `UPDATE users SET ${setClause}${clause}`;

      expect(query).toBe('UPDATE users SET u.status = $1 WHERE u.role IN ($2, $3) AND u.last_login <= $4');
      expect(params).toEqual(['INACTIVE', 'GUEST', 'TRIAL', '2023-01-01']);
    });
  });

  describe('DELETE query integration', () => {
    test('Postgres: DELETE with buildWhereClause', () => {
      const h = dialectHelpers('postgres');
      const mapper = { status: 'u.status', deletedAt: 'u.deleted_at' };

      const { clause, params } = h.buildWhereClause(
        [
          { key: 'status', operation: 'EQ', value: 'DEACTIVATED' },
          { key: 'deletedAt', operation: 'NOT_NULL' },
        ],
        [], mapper
      );

      const query = `DELETE FROM users${clause}`;

      expect(query).toBe('DELETE FROM users WHERE u.status = $1 AND u.deleted_at IS NOT NULL');
      expect(params).toEqual(['DEACTIVATED']);
    });
  });
});
