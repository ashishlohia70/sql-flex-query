import { describe, test, expect } from 'vitest';
import {
  buildQueries,
  buildCursorPage,
  encodeCursor,
  decodeCursor,
  QueryBuilder,
  type SortCriteria,
} from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*HAVING_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

const NEWEST_FIRST: SortCriteria[] = [
  { key: 'createdAt', direction: 'DESC' },
  { key: 'id', direction: 'DESC' },
];
const MAPPER = { createdAt: 'u.created_at', id: 'u.id', status: 'u.status' };
const squash = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('Cursor pagination: SQL generation', () => {
  test('first page has no cursor condition and fetches size + 1 rows', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      whereParams: [{ key: 'status', operation: 'EQ', value: 'ACTIVE' }],
      sortBy: NEWEST_FIRST,
      columnMapper: MAPPER,
      size: 20,
      cursor: {},
    });
    expect(squash(result.searchQuery)).toBe(
      'SELECT * FROM users u WHERE u.status = $1 ORDER BY u.created_at DESC, u.id DESC LIMIT 21 OFFSET 0',
    );
    expect(result.params).toEqual(['ACTIVE']);
    expect(result.countParams).toEqual(['ACTIVE']);
    expect(result.cursorMeta).toEqual({
      sortBy: NEWEST_FIRST,
      size: 20,
      direction: 'forward',
      hasCursor: false,
    });
  });

  test('single-key ascending "after" cursor', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: [{ key: 'id', direction: 'ASC' }],
      size: 10,
      cursor: { after: { id: 100 } },
    });
    expect(squash(result.searchQuery)).toBe(
      'SELECT * FROM users u WHERE ("id" > $1) ORDER BY "id" ASC LIMIT 11 OFFSET 0',
    );
    expect(result.params).toEqual([100]);
  });

  test('multi-key "after" cursor with mixed directions', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: [
        { key: 'lastName', direction: 'ASC' },
        { key: 'score', direction: 'DESC' },
        { key: 'id', direction: 'ASC' },
      ],
      size: 5,
      cursor: { after: { lastName: 'Smith', score: 90, id: 7 } },
    });
    expect(squash(result.searchQuery)).toContain(
      'WHERE ("lastName" > $1 OR ("lastName" = $2 AND "score" < $3) OR ("lastName" = $4 AND "score" = $5 AND "id" > $6))',
    );
    expect(result.params).toEqual(['Smith', 'Smith', 90, 'Smith', 90, 7]);
  });

  test('"before" cursor flips the comparison and the ORDER BY', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: NEWEST_FIRST,
      columnMapper: MAPPER,
      size: 10,
      cursor: { before: { createdAt: '2024-05-01', id: 50 } },
    });
    expect(squash(result.searchQuery)).toBe(
      'SELECT * FROM users u WHERE (u.created_at > $1 OR (u.created_at = $2 AND u.id > $3)) ' +
        'ORDER BY u.created_at ASC, u.id ASC LIMIT 11 OFFSET 0',
    );
    expect(result.cursorMeta?.direction).toBe('backward');
    // meta keeps the requested order, not the reversed one
    expect(result.cursorMeta?.sortBy).toEqual(NEWEST_FIRST);
  });

  test('lowercase sort directions are honoured', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: [{ key: 'id', direction: 'desc' as any }],
      cursor: { after: { id: 5 } },
    });
    expect(result.searchQuery).toContain('("id" < $1)');
  });

  test('params follow textual order: text search, where, cursor, having', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      textSearchParams: [{ key: 'name', operation: 'LIKE', value: '%jo%' }],
      whereParams: [
        { key: 'status', operation: 'EQ', value: 'ACTIVE' },
        { key: 'total', operation: 'GT', value: 3, having: true },
      ],
      sortBy: [{ key: 'id', direction: 'ASC' }],
      size: 10,
      cursor: { after: { id: 9 } },
    });
    expect(squash(result.searchQuery)).toContain(
      'WHERE ("name" LIKE $1) AND "status" = $2 AND ("id" > $3) HAVING "total" > $4',
    );
    expect(result.params).toEqual(['%jo%', 'ACTIVE', 9, 3]);
  });

  test('count query excludes the cursor condition and has its own params', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      whereParams: [
        { key: 'status', operation: 'EQ', value: 'ACTIVE' },
        { key: 'total', operation: 'GT', value: 3, having: true },
      ],
      sortBy: [{ key: 'id', direction: 'ASC' }],
      cursor: { after: { id: 9 } },
    });
    expect(squash(result.countQuery)).toBe(
      'SELECT COUNT(1) AS count FROM users u WHERE "status" = $1 HAVING "total" > $2',
    );
    expect(result.countParams).toEqual(['ACTIVE', 3]);
  });

  test('page is ignored in cursor mode', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: [{ key: 'id', direction: 'ASC' }],
      page: 7,
      size: 10,
      cursor: {},
    });
    expect(result.searchQuery).toContain('LIMIT 11 OFFSET 0');
  });

  test('countParams equals params when no cursor is used', () => {
    const result = buildQueries(BASE, [{ key: 'status', operation: 'EQ', value: 'A' }]);
    expect(result.countParams).toEqual(result.params);
    expect(result.countParams).not.toBe(result.params);
    expect(result.cursorMeta).toBeUndefined();
  });
});

describe('Cursor pagination: dialects', () => {
  const build = (dialect: string) =>
    buildQueries({
      baseQueryTemplate: BASE,
      whereParams: [{ key: 'status', operation: 'EQ', value: 'ACTIVE' }],
      sortBy: [
        { key: 'createdAt', direction: 'DESC' },
        { key: 'id', direction: 'ASC' },
      ],
      size: 10,
      dialect,
      cursor: { after: { createdAt: '2024-01-01', id: 5 } },
    });

  test('mysql', () => {
    const r = build('mysql');
    expect(squash(r.searchQuery)).toBe(
      'SELECT * FROM users u WHERE `status` = ? AND (`createdAt` < ? OR (`createdAt` = ? AND `id` > ?)) ' +
        'ORDER BY `createdAt` DESC, `id` ASC LIMIT 11 OFFSET 0',
    );
    expect(r.params).toEqual(['ACTIVE', '2024-01-01', '2024-01-01', 5]);
  });

  test('sqlite', () => {
    expect(build('sqlite').searchQuery).toContain('("createdAt" < ? OR ("createdAt" = ? AND "id" > ?))');
  });

  test('snowflake', () => {
    expect(build('snowflake').searchQuery).toContain('LIMIT 11 OFFSET 0');
  });

  test('cockroach', () => {
    expect(build('cockroach').searchQuery).toContain('("createdAt" < $2 OR ("createdAt" = $3 AND "id" > $4))');
  });

  test('mssql merges pagination into ORDER BY', () => {
    const r = build('mssql');
    expect(squash(r.searchQuery)).toBe(
      'SELECT * FROM users u WHERE [status] = @p1 AND ([createdAt] < @p2 OR ([createdAt] = @p3 AND [id] > @p4)) ' +
        'ORDER BY [createdAt] DESC, [id] ASC OFFSET 0 ROWS FETCH NEXT 11 ROWS ONLY',
    );
    expect(r.countQuery).not.toContain('FETCH');
  });

  test('oracle', () => {
    const r = build('oracle');
    expect(squash(r.searchQuery)).toContain(
      'WHERE "status" = :1 AND ("createdAt" < :2 OR ("createdAt" = :3 AND "id" > :4)) ' +
        'ORDER BY "createdAt" DESC, "id" ASC OFFSET 0 ROWS FETCH NEXT 11 ROWS ONLY',
    );
  });
});

describe('Cursor pagination: validation', () => {
  const opts = (extra: object) => ({
    baseQueryTemplate: BASE,
    sortBy: [{ key: 'id', direction: 'ASC' as const }],
    ...extra,
  });

  test('requires sortBy', () => {
    expect(() => buildQueries({ baseQueryTemplate: BASE, cursor: {} })).toThrow('requires sortBy');
  });

  test('rejects after + before together', () => {
    expect(() => buildQueries(opts({ cursor: { after: { id: 1 }, before: { id: 9 } } }))).toThrow(
      'not both',
    );
  });

  test('rejects invalid sizes', () => {
    expect(() => buildQueries(opts({ size: 2.5, cursor: {} }))).toThrow('Invalid size');
    expect(() => buildQueries(opts({ size: '10; --' as any, cursor: {} }))).toThrow('Invalid size');
    expect(() => buildQueries(opts({ size: '0' as any, cursor: {} }))).toThrow('positive integer');
  });

  test('digit-string size is coerced, not concatenated ("10" + 1 must be 11)', () => {
    const r = buildQueries(opts({ size: '10' as any, cursor: {} }));
    expect(r.searchQuery).toContain('LIMIT 11 OFFSET 0');
    expect(r.cursorMeta?.size).toBe(10);
  });

  test('rejects a cursor missing a sort key', () => {
    expect(() => buildQueries(opts({ cursor: { after: { other: 1 } } }))).toThrow(
      'missing a value for sort key "id"',
    );
  });

  test('rejects null cursor values', () => {
    expect(() => buildQueries(opts({ cursor: { after: { id: null } } }))).toThrow('is null');
  });

  test('rejects object/array cursor values (driver expansion risk)', () => {
    expect(() => buildQueries(opts({ cursor: { after: { id: { a: 1 } } } }))).toThrow(
      'must be a string, number',
    );
    const tampered = encodeCursor({ id: [1, 2] });
    expect(() => buildQueries(opts({ cursor: { after: tampered } }))).toThrow('must be a string, number');
  });

  test('rejects malformed tokens', () => {
    expect(() => buildQueries(opts({ cursor: { after: 'not a cursor!' } }))).toThrow('Invalid cursor');
    expect(() => buildQueries(opts({ cursor: { after: encodeCursor({}).slice(0, 1) } }))).toThrow(
      'Invalid cursor',
    );
  });

  test('empty-string and null cursors mean "first page"', () => {
    const r1 = buildQueries(opts({ cursor: { after: '' } }));
    const r2 = buildQueries(opts({ cursor: { after: null } }));
    expect(r1.cursorMeta?.hasCursor).toBe(false);
    expect(r2.params).toEqual([]);
  });

  test('cursor keys are never used as SQL: only sortBy keys are read', () => {
    const r = buildQueries(opts({ cursor: { after: { id: 1, 'x"; DROP TABLE users; --': 1 } } }));
    expect(r.searchQuery).not.toContain('DROP');
    expect(r.params).toEqual([1]);
  });
});

describe('Cursor codec', () => {
  test('round-trips primitives, unicode and dates', () => {
    const values = { name: 'José 🚀 中文', n: 42, ok: true, at: new Date('2024-03-04T05:06:07.890Z') };
    const decoded = decodeCursor(encodeCursor(values));
    expect(decoded).toEqual(values);
    expect(decoded.at).toBeInstanceOf(Date);
  });

  test('produces unpadded base64url identical to Node Buffer', () => {
    for (const values of [{ a: 1 }, { ab: 'x' }, { abc: 'yz' }, { k: 'ü?>' }]) {
      const json = JSON.stringify(values);
      expect(encodeCursor(values)).toBe(Buffer.from(json, 'utf8').toString('base64url'));
    }
  });

  test('decodes tokens that kept "=" padding', () => {
    const padded = Buffer.from('{"id":1}').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    expect(decodeCursor(padded)).toEqual({ id: 1 });
  });

  test('rejects tokens that decode to non-objects', () => {
    expect(() => decodeCursor(Buffer.from('[1,2]').toString('base64url'))).toThrow('Invalid cursor');
    expect(() => decodeCursor(Buffer.from('null').toString('base64url'))).toThrow('Invalid cursor');
  });
});

describe('buildCursorPage', () => {
  const rows = (ids: number[]) => ids.map((id) => ({ id, name: `user${id}` }));
  const sortById: SortCriteria[] = [{ key: 'id', direction: 'ASC' }];

  test('first page with more rows available', () => {
    const result = buildQueries({ baseQueryTemplate: BASE, sortBy: sortById, size: 3, cursor: {} });
    const page = buildCursorPage(rows([1, 2, 3, 4]), result);
    expect(page.items.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(page.hasNextPage).toBe(true);
    expect(page.hasPreviousPage).toBe(false);
    expect(decodeCursor(page.nextCursor!)).toEqual({ id: 3 });
    expect(page.prevCursor).toBeNull();
  });

  test('last forward page', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: sortById,
      size: 3,
      cursor: { after: encodeCursor({ id: 3 }) },
    });
    const page = buildCursorPage(rows([4, 5]), result);
    expect(page.items.map((r) => r.id)).toEqual([4, 5]);
    expect(page.hasNextPage).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.hasPreviousPage).toBe(true);
    expect(decodeCursor(page.prevCursor!)).toEqual({ id: 4 });
  });

  test('backward page restores the requested order', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: sortById,
      size: 3,
      cursor: { before: { id: 8 } },
    });
    // the DB returns rows in reversed order (id DESC) with one look-ahead row
    const page = buildCursorPage(rows([7, 6, 5, 4]), result);
    expect(page.items.map((r) => r.id)).toEqual([5, 6, 7]);
    expect(page.hasPreviousPage).toBe(true);
    expect(page.hasNextPage).toBe(true);
    expect(decodeCursor(page.prevCursor!)).toEqual({ id: 5 });
    expect(decodeCursor(page.nextCursor!)).toEqual({ id: 7 });
  });

  test('empty result', () => {
    const result = buildQueries({ baseQueryTemplate: BASE, sortBy: sortById, size: 3, cursor: {} });
    expect(buildCursorPage([], result)).toEqual({
      items: [],
      hasNextPage: false,
      hasPreviousPage: false,
      nextCursor: null,
      prevCursor: null,
    });
  });

  test('reads table-qualified sort keys from the bare column name', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: [{ key: 'u.id', direction: 'ASC' }],
      size: 1,
      cursor: {},
    });
    const page = buildCursorPage(rows([1, 2]), result);
    expect(decodeCursor(page.nextCursor!)).toEqual({ 'u.id': 1 });
  });

  test('throws a helpful error when a sort key was not selected', () => {
    const result = buildQueries({
      baseQueryTemplate: BASE,
      sortBy: [{ key: 'createdAt', direction: 'DESC' }],
      size: 1,
      cursor: {},
    });
    expect(() => buildCursorPage(rows([1, 2]), result)).toThrow('row has no "createdAt" field');
  });

  test('throws when the result was not built with a cursor', () => {
    expect(() => buildCursorPage([], buildQueries(BASE))).toThrow('needs a result built with cursor');
  });
});

describe('QueryBuilder.cursorPaginate()', () => {
  test('builds a cursor query and round-trips through buildCursorPage', () => {
    const qb = () =>
      new QueryBuilder('postgres')
        .baseQuery(BASE)
        .columnMapper(MAPPER)
        .select(['id', 'createdAt'])
        .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
        .orderBy(NEWEST_FIRST);

    const first = qb().cursorPaginate(2).build();
    expect(first.searchQuery).toContain('LIMIT 3 OFFSET 0');
    const page1 = buildCursorPage(
      [
        { id: 30, createdAt: new Date('2024-01-03') },
        { id: 20, createdAt: new Date('2024-01-02') },
        { id: 10, createdAt: new Date('2024-01-01') },
      ],
      first,
    );

    const second = qb().cursorPaginate(2, { after: page1.nextCursor }).build();
    expect(squash(second.searchQuery)).toContain(
      'WHERE u.status = $1 AND (u.created_at < $2 OR (u.created_at = $3 AND u.id < $4))',
    );
    expect(second.params).toEqual(['ACTIVE', new Date('2024-01-02'), new Date('2024-01-02'), 20]);
    expect(second.countParams).toEqual(['ACTIVE']);
  });

  test('paginate() after cursorPaginate() switches back to offset mode', () => {
    const r = new QueryBuilder()
      .baseQuery(BASE)
      .sortBy('id')
      .cursorPaginate(5, { after: { id: 1 } })
      .paginate(2, 5)
      .build();
    expect(r.searchQuery).toContain('LIMIT 5 OFFSET 5');
    expect(r.cursorMeta).toBeUndefined();
  });

  test('reset() clears cursor mode', () => {
    const r = new QueryBuilder()
      .baseQuery(BASE)
      .cursorPaginate(5)
      .reset()
      .baseQuery(BASE)
      .build();
    expect(r.cursorMeta).toBeUndefined();
  });
});
