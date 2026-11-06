/**
 * Integration tests: run the generated SQL against a real (in-memory) SQLite database
 * and compare the returned rows with an independent JavaScript computation.
 *
 * The unit tests assert SQL strings. These catch what strings can't: placeholder/param
 * misalignment, SQL that doesn't parse, wrong rows, and pagination that skips or
 * repeats rows. Uses Node's built-in `node:sqlite` (Node >= 22.13), so there is no
 * extra dependency. The suite is skipped on older runtimes.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  buildQueries,
  buildCursorPage,
  dialectHelpers,
  QueryBuilder,
  type BuildOptions,
  type BuildResult,
  type Criteria,
  type CursorPage,
  type CursorPagination,
  type SortCriteria,
} from '../../src';

const sqlite = await import('node:sqlite').catch(() => null);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE users (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    status TEXT NOT NULL, role TEXT NOT NULL, age INTEGER NOT NULL,
    dept_id INTEGER NOT NULL REFERENCES departments(id),
    created_at TEXT NOT NULL, deleted_at TEXT
  );
  CREATE TABLE events (
    id INTEGER PRIMARY KEY, category TEXT NOT NULL, label TEXT NOT NULL,
    score INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, amount INTEGER NOT NULL);
`;

const DEPARTMENTS = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Sales' },
  { id: 3, name: 'Support' },
];

// Hand-written so every expectation can be checked by eye. Includes boundary ages
// (25, 30, 41), duplicate ages, NULLs, mixed-case names and a quote in a name.
const USERS = [
  { id: 1, name: 'Alice Smith', email: 'alice@acme.io', status: 'ACTIVE', role: 'ADMIN', age: 34, dept_id: 1, created_at: '2024-01-05', deleted_at: null },
  { id: 2, name: 'Bob Jones', email: 'bob@acme.io', status: 'ACTIVE', role: 'USER', age: 28, dept_id: 2, created_at: '2024-01-07', deleted_at: null },
  { id: 3, name: 'Carol Smithers', email: 'carol@corp.com', status: 'INACTIVE', role: 'USER', age: 45, dept_id: 1, created_at: '2024-02-01', deleted_at: '2024-06-01' },
  { id: 4, name: 'Dan Brown', email: 'dan@corp.com', status: 'PENDING', role: 'GUEST', age: 19, dept_id: 3, created_at: '2024-02-14', deleted_at: null },
  { id: 5, name: 'Eve Adams', email: 'eve@acme.io', status: 'ACTIVE', role: 'USER', age: 30, dept_id: 2, created_at: '2024-03-03', deleted_at: null },
  { id: 6, name: "Fiona O'Brien", email: 'fiona@acme.io', status: 'ACTIVE', role: 'ADMIN', age: 30, dept_id: 3, created_at: '2024-03-03', deleted_at: null },
  { id: 7, name: 'George Smith', email: 'george@corp.com', status: 'INACTIVE', role: 'GUEST', age: 52, dept_id: 1, created_at: '2024-04-20', deleted_at: '2024-07-15' },
  { id: 8, name: 'Hana Kim', email: 'hana@acme.io', status: 'ACTIVE', role: 'USER', age: 41, dept_id: 2, created_at: '2024-05-11', deleted_at: null },
  { id: 9, name: 'Ivan Petrov', email: 'ivan@corp.com', status: 'PENDING', role: 'USER', age: 25, dept_id: 3, created_at: '2024-05-30', deleted_at: null },
  { id: 10, name: 'Julia Smith', email: 'julia@acme.io', status: 'ACTIVE', role: 'USER', age: 30, dept_id: 1, created_at: '2024-06-18', deleted_at: null },
];
type User = (typeof USERS)[number];

// Generated: 7 distinct scores and 9 distinct timestamps across 120 rows, so sort
// keys tie constantly. That is the hard case for keyset pagination.
const EVENTS = Array.from({ length: 120 }, (_, i) => {
  const id = i + 1;
  return {
    id,
    category: ['alpha', 'beta', 'gamma'][id % 3],
    label: `event-${id}`,
    score: (id * 37) % 7,
    createdAt: `2024-03-${String(((id * 11) % 9) + 1).padStart(2, '0')}T00:00:00Z`,
  };
});
type Event = (typeof EVENTS)[number];

const ORDERS = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  user_id: ((i * 7) % 25) + 1,
  amount: (i * 13) % 60,
}));

const USERS_BASE = `SELECT /*SELECT_COLUMNS*/ FROM users /*WHERE_CLAUSE*/ /*ORDER_BY*/ /*LIMIT_CLAUSE*/`;
const EVENTS_BASE = `SELECT /*SELECT_COLUMNS*/ FROM events e /*WHERE_CLAUSE*/ /*ORDER_BY*/ /*LIMIT_CLAUSE*/`;
const EVENTS_MAPPER = {
  id: 'e.id',
  category: 'e.category',
  label: 'e.label',
  score: 'e.score',
  createdAt: 'e.created_at',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let db: any;

function insertRows(table: string, columns: string[], rows: Record<string, any>[]) {
  const stmt = db.prepare(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
  );
  for (const row of rows) stmt.run(...columns.map((c) => row[c]));
}

function insertEvents(events: Event[]) {
  insertRows(
    'events',
    ['id', 'category', 'label', 'score', 'created_at'],
    events.map((e) => ({ ...e, created_at: e.createdAt })),
  );
}

function openDb() {
  db = new sqlite!.DatabaseSync(':memory:');
  db.exec(SCHEMA);
  // SQLite's LIKE ignores ASCII case by default; make it case-sensitive so the
  // ignoreCase option is actually exercised (verified by the first test below).
  db.exec('PRAGMA case_sensitive_like = ON');
  insertRows('departments', ['id', 'name'], DEPARTMENTS);
  insertRows('users', Object.keys(USERS[0]), USERS);
  insertEvents(EVENTS);
  insertRows('orders', ['id', 'user_id', 'amount'], ORDERS);
}

/** Runs a query; rows are copied to plain objects for clean equality checks. */
const all = (sql: string, params: any[]): Record<string, any>[] =>
  db.prepare(sql).all(...params).map((row: object) => ({ ...row }));

/** Runs countQuery with countParams (never params: they differ in cursor mode). */
const countOf = (result: BuildResult): number =>
  db.prepare(result.countQuery).get(...result.countParams).count;

const ids = (rows: Record<string, any>[], key = 'id') => rows.map((r) => r[key]);

/** Independent JS implementation of a multi-key ORDER BY (ASCII data, so JS order = SQLite BINARY). */
function sortLike<T extends Record<string, any>>(rows: T[], sortBy: SortCriteria[]): T[] {
  return [...rows].sort((a, b) => {
    for (const { key, direction } of sortBy) {
      if (a[key] < b[key]) return direction === 'ASC' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'ASC' ? 1 : -1;
    }
    return 0;
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function runUsers(opts: Partial<BuildOptions>) {
  const result = buildQueries({
    baseQueryTemplate: USERS_BASE,
    dialect: 'sqlite',
    sortBy: [{ key: 'id', direction: 'ASC' }],
    ...opts,
  });
  return { result, rows: all(result.searchQuery, result.params), count: countOf(result) };
}

const fetchCursorPage = (result: BuildResult) =>
  buildCursorPage(all(result.searchQuery, result.params), result);

/**
 * Follows nextCursor from the first page to the last, then follows prevCursor from
 * the last page back to the first. Records the count query's total on every request.
 */
function walkCursor(build: (cursor: CursorPagination) => BuildResult, idKey = 'id') {
  const pages: CursorPage<Record<string, any>>[] = [];
  const totals: number[] = [];

  let result = build({});
  for (;;) {
    if (pages.length > 1000) throw new Error('forward walk did not terminate');
    const page = fetchCursorPage(result);
    pages.push(page);
    totals.push(countOf(result));
    if (!page.hasNextPage) break;
    result = build({ after: page.nextCursor });
  }

  const backward: any[][] = [];
  let page = pages[pages.length - 1];
  while (page.hasPreviousPage) {
    if (backward.length > 1000) throw new Error('backward walk did not terminate');
    page = fetchCursorPage(build({ before: page.prevCursor }));
    backward.unshift(ids(page.items, idKey));
  }

  return { pages, forward: pages.map((p) => ids(p.items, idKey)), backward, totals };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!sqlite)('SQLite integration', () => {
  beforeEach(openDb);
  afterEach(() => db.close());

  test('fixture: LIKE is case-sensitive, so ignoreCase is meaningful', () => {
    expect(db.prepare(`SELECT 'A' LIKE 'a' AS m`).get().m).toBe(0);
  });

  describe('operations return the right rows', () => {
    const CASES: [string, Criteria, (u: User) => boolean][] = [
      ['EQ', { key: 'status', operation: 'EQ', value: 'ACTIVE' }, (u) => u.status === 'ACTIVE'],
      ['NEQ', { key: 'status', operation: 'NEQ', value: 'ACTIVE' }, (u) => u.status !== 'ACTIVE'],
      ['GT', { key: 'age', operation: 'GT', value: 30 }, (u) => u.age > 30],
      ['LT', { key: 'age', operation: 'LT', value: 30 }, (u) => u.age < 30],
      ['GTE', { key: 'age', operation: 'GTE', value: 30 }, (u) => u.age >= 30],
      ['LTE', { key: 'age', operation: 'LTE', value: 30 }, (u) => u.age <= 30],
      ['LIKE', { key: 'name', operation: 'LIKE', value: '%Smith%' }, (u) => u.name.includes('Smith')],
      [
        'LIKE with ignoreCase',
        { key: 'name', operation: 'LIKE', value: '%SMITH%', ignoreCase: true },
        (u) => u.name.toLowerCase().includes('smith'),
      ],
      ['LIKE without ignoreCase is case-sensitive', { key: 'name', operation: 'LIKE', value: '%SMITH%' }, () => false],
      ['NOT_LIKE', { key: 'email', operation: 'NOT_LIKE', value: '%@acme.io' }, (u) => !u.email.endsWith('@acme.io')],
      ['IN', { key: 'role', operation: 'IN', value: ['ADMIN', 'GUEST'] }, (u) => ['ADMIN', 'GUEST'].includes(u.role)],
      // Emitted as `1 = 0` (not `IN ()`, which most databases reject)
      ['IN with an empty list matches nothing', { key: 'role', operation: 'IN', value: [] }, () => false],
      ['NULL', { key: 'deleted_at', operation: 'NULL' }, (u) => u.deleted_at === null],
      ['NOT_NULL', { key: 'deleted_at', operation: 'NOT_NULL' }, (u) => u.deleted_at !== null],
      [
        'BETWEEN is half-open [25, 41)',
        { key: 'age', operation: 'BETWEEN', value: [25, 41] },
        (u) => u.age >= 25 && u.age < 41,
      ],
      ['a quote in a value is bound safely', { key: 'name', operation: 'EQ', value: "Fiona O'Brien" }, (u) => u.name === "Fiona O'Brien"],
      ['SQL in a value is just data', { key: 'name', operation: 'EQ', value: "x' OR '1'='1" }, () => false],
    ];

    test.each(CASES)('%s', (_name, criteria, predicate) => {
      const expected = USERS.filter(predicate).map((u) => u.id);
      expect(expected.length).toBeLessThan(USERS.length); // guards against a vacuous fixture

      const { rows, count } = runUsers({ whereParams: [criteria] });

      expect(ids(rows)).toEqual(expected);
      expect(count).toBe(expected.length);
    });
  });

  test('text search (OR) combined with where (AND)', () => {
    const { rows, count, result } = runUsers({
      textSearchParams: [
        { key: 'name', operation: 'LIKE', value: '%an%' },
        { key: 'email', operation: 'LIKE', value: '%corp%' },
      ],
      whereParams: [
        { key: 'status', operation: 'NEQ', value: 'INACTIVE' },
        { key: 'age', operation: 'GTE', value: 25 },
      ],
    });
    const expected = USERS.filter(
      (u) =>
        (u.name.includes('an') || u.email.includes('corp')) && u.status !== 'INACTIVE' && u.age >= 25,
    ).map((u) => u.id);

    expect(expected).toEqual([8, 9]);
    expect(ids(rows)).toEqual(expected);
    expect(count).toBe(2);
    expect(result.params).toEqual(['%an%', '%corp%', 'INACTIVE', 25]);
  });

  test('empty IN inside a text-search OR group: other branches still match, params stay aligned', () => {
    const { rows, count, result } = runUsers({
      textSearchParams: [
        { key: 'role', operation: 'IN', value: [] },
        { key: 'name', operation: 'LIKE', value: '%Smith%' },
      ],
      whereParams: [{ key: 'status', operation: 'EQ', value: 'ACTIVE' }],
    });
    const expected = USERS.filter((u) => u.name.includes('Smith') && u.status === 'ACTIVE').map((u) => u.id);

    expect(expected).toEqual([1, 10]);
    expect(ids(rows)).toEqual(expected);
    expect(count).toBe(2);
    expect(result.params).toEqual(['%Smith%', 'ACTIVE']);
  });

  test('JOIN + GROUP BY + HAVING with text search and where; count via modifyCountQuery', () => {
    const result = new QueryBuilder('sqlite')
      .baseQuery(
        `SELECT /*SELECT_COLUMNS*/ FROM users u JOIN departments d ON d.id = u.dept_id
         /*WHERE_CLAUSE*/ GROUP BY d.name /*HAVING_CLAUSE*/ /*ORDER_BY*/ /*LIMIT_CLAUSE*/`,
      )
      .columnMapper({
        dept: 'd.name',
        headcount: 'COUNT(u.id)',
        avgAge: 'AVG(u.age)',
        name: 'u.name',
        email: 'u.email',
        status: 'u.status',
      })
      .select(['dept', 'headcount', 'avgAge'])
      .textSearch([
        { key: 'name', operation: 'LIKE', value: '%e%' },
        { key: 'email', operation: 'LIKE', value: '%acme%' },
      ])
      .where({ key: 'status', operation: 'NEQ', value: 'PENDING' })
      .having({ key: 'headcount', operation: 'GTE', value: 2 })
      .sortBy('dept', 'ASC')
      .modifyCountQuery((q) => `SELECT COUNT(*) AS count FROM (${q}) t`)
      .build();

    const matching = USERS.filter(
      (u) => (u.name.includes('e') || u.email.includes('acme')) && u.status !== 'PENDING',
    );
    const expected = DEPARTMENTS.map((d) => {
      const members = matching.filter((u) => u.dept_id === d.id);
      return {
        dept: d.name,
        headcount: members.length,
        avgAge: members.reduce((sum, u) => sum + u.age, 0) / members.length,
      };
    }).filter((g) => g.headcount >= 2);

    expect(expected.map((g) => g.dept)).toEqual(['Engineering', 'Sales']);
    expect(all(result.searchQuery, result.params)).toEqual(expected);
    expect(countOf(result)).toBe(2);
    expect(result.params).toEqual(['%e%', '%acme%', 'PENDING', 2]);
  });

  test('JOIN with column mapping and DISTINCT; count counts distinct values', () => {
    const result = buildQueries({
      baseQueryTemplate: `SELECT /*SELECT_COLUMNS*/ FROM users u JOIN departments d ON d.id = u.dept_id
                          /*WHERE_CLAUSE*/ /*ORDER_BY*/ /*LIMIT_CLAUSE*/`,
      dialect: 'sqlite',
      columnMapper: { dept: 'd.name', age: 'u.age' },
      selectColumns: ['dept'],
      distinct: true,
      whereParams: [{ key: 'age', operation: 'GTE', value: 40 }],
      sortBy: [{ key: 'dept', direction: 'ASC' }],
    });

    expect(all(result.searchQuery, result.params)).toEqual([{ dept: 'Engineering' }, { dept: 'Sales' }]);
    expect(countOf(result)).toBe(2);
  });

  describe('offset pagination', () => {
    test('pages cover every row once, in order; the count stays the total', () => {
      const sortBy: SortCriteria[] = [
        { key: 'age', direction: 'DESC' },
        { key: 'id', direction: 'ASC' },
      ];
      const expectedPages = chunk(sortLike(USERS, sortBy).map((u) => u.id), 3);
      expect(expectedPages).toEqual([[7, 3, 8], [1, 5, 6], [10, 2, 9], [4]]);

      expectedPages.forEach((expected, i) => {
        const { rows, count } = runUsers({ sortBy, page: i + 1, size: 3 });
        expect(ids(rows)).toEqual(expected);
        expect(count).toBe(USERS.length);
      });

      expect(runUsers({ sortBy, page: 5, size: 3 }).rows).toEqual([]);
    });

    test('page and size given as digit strings (e.g. from req.query) work', () => {
      const { rows } = runUsers({ page: '2' as any, size: '4' as any });
      expect(ids(rows)).toEqual([5, 6, 7, 8]);
    });
  });

  describe('cursor pagination', () => {
    const SCENARIOS: {
      name: string;
      sortBy: SortCriteria[];
      size: number;
      textSearch?: Criteria[];
      where?: Criteria[];
      filter?: (e: Event) => boolean;
    }[] = [
      { name: 'single unique key', sortBy: [{ key: 'id', direction: 'ASC' }], size: 10 },
      {
        name: 'mixed directions over heavily tied keys',
        sortBy: [
          { key: 'score', direction: 'DESC' },
          { key: 'id', direction: 'ASC' },
        ],
        size: 7,
      },
      {
        name: 'three keys with text search and where (params: search, where, cursor)',
        sortBy: [
          { key: 'createdAt', direction: 'DESC' },
          { key: 'score', direction: 'ASC' },
          { key: 'id', direction: 'DESC' },
        ],
        size: 6,
        textSearch: [
          { key: 'label', operation: 'LIKE', value: '%1%' },
          { key: 'label', operation: 'LIKE', value: '%7%' },
        ],
        where: [{ key: 'category', operation: 'IN', value: ['alpha', 'beta'] }],
        filter: (e) =>
          (e.label.includes('1') || e.label.includes('7')) && ['alpha', 'beta'].includes(e.category),
      },
      {
        name: 'page size 1',
        sortBy: [
          { key: 'score', direction: 'ASC' },
          { key: 'id', direction: 'ASC' },
        ],
        size: 1,
        where: [{ key: 'id', operation: 'LTE', value: 9 }],
        filter: (e) => e.id <= 9,
      },
      { name: 'everything fits on one page', sortBy: [{ key: 'id', direction: 'DESC' }], size: 500 },
    ];

    test.each(SCENARIOS)('$name', ({ sortBy, size, textSearch = [], where = [], filter = () => true }) => {
      const expected = sortLike(EVENTS.filter(filter), sortBy).map((e) => e.id);
      expect(expected.length).toBeGreaterThan(0);

      const build = (cursor: CursorPagination) =>
        new QueryBuilder('sqlite')
          .baseQuery(EVENTS_BASE)
          .columnMapper(EVENTS_MAPPER)
          .select(['id', 'score', 'createdAt'])
          .textSearch(textSearch)
          .where(where)
          .orderBy(sortBy)
          .cursorPaginate(size, cursor)
          .build();

      const { pages, forward, backward, totals } = walkCursor(build);

      expect(forward).toEqual(chunk(expected, size)); // every row once, in order, full pages
      expect(backward).toEqual(forward.slice(0, -1)); // prevCursor retraces the same pages
      expect(totals.every((t) => t === expected.length)).toBe(true);
      expect(pages[0].hasPreviousPage).toBe(false);
      expect(pages[0].prevCursor).toBeNull();
      expect(pages.slice(1).every((p) => p.hasPreviousPage)).toBe(true);
    });

    test('GROUP BY + HAVING: params ordered where, cursor, having; count is the total', () => {
      const build = (cursor: CursorPagination) =>
        new QueryBuilder('sqlite')
          .baseQuery(
            `SELECT /*SELECT_COLUMNS*/ FROM orders o /*WHERE_CLAUSE*/ GROUP BY o.user_id
             /*HAVING_CLAUSE*/ /*ORDER_BY*/ /*LIMIT_CLAUSE*/`,
          )
          .columnMapper({ userId: 'o.user_id', total: 'SUM(o.amount)', amount: 'o.amount' })
          .select(['userId', 'total'])
          .where({ key: 'amount', operation: 'GTE', value: 10 })
          .having({ key: 'total', operation: 'GT', value: 200 })
          .sortBy('userId', 'ASC')
          .modifyCountQuery((q) => `SELECT COUNT(*) AS count FROM (${q}) t`)
          .cursorPaginate(4, cursor)
          .build();

      const totalsByUser = new Map<number, number>();
      for (const o of ORDERS.filter((o) => o.amount >= 10)) {
        totalsByUser.set(o.user_id, (totalsByUser.get(o.user_id) ?? 0) + o.amount);
      }
      const expected = [...totalsByUser]
        .filter(([, total]) => total > 200)
        .map(([userId, total]) => ({ userId, total }))
        .sort((a, b) => a.userId - b.userId);
      expect(expected.length).toBeGreaterThan(8); // several pages
      expect(expected.length).toBeLessThan(totalsByUser.size); // HAVING filters something

      const { pages, forward, backward, totals } = walkCursor(build, 'userId');

      expect(pages.flatMap((p) => p.items)).toEqual(expected);
      expect(backward).toEqual(forward.slice(0, -1));
      expect(totals.every((t) => t === expected.length)).toBe(true);

      const second = build({ after: pages[0].nextCursor });
      expect(second.params).toEqual([10, expected[3].userId, 200]);
      expect(second.countParams).toEqual([10, 200]);
    });

    test('new rows inserted ahead of the cursor do not shift the next page (offset pages do)', () => {
      const sortBy: SortCriteria[] = [
        { key: 'createdAt', direction: 'DESC' },
        { key: 'id', direction: 'DESC' },
      ];
      const expected = sortLike(EVENTS, sortBy).map((e) => e.id);
      const qb = () =>
        new QueryBuilder('sqlite')
          .baseQuery(EVENTS_BASE)
          .columnMapper(EVENTS_MAPPER)
          .select(['id', 'createdAt'])
          .orderBy(sortBy);

      const page1 = fetchCursorPage(qb().cursorPaginate(5).build());
      expect(ids(page1.items)).toEqual(expected.slice(0, 5));

      // Three newer events arrive between requests
      insertEvents(
        [1001, 1002, 1003].map((id) => ({
          id,
          category: 'alpha',
          label: `event-${id}`,
          score: 0,
          createdAt: '2024-12-31T00:00:00Z',
        })),
      );

      const page2 = fetchCursorPage(qb().cursorPaginate(5, { after: page1.nextCursor }).build());
      expect(ids(page2.items)).toEqual(expected.slice(5, 10));

      // For contrast: offset page 2 now repeats the last three rows of page 1
      const offset = qb().paginate(2, 5).build();
      expect(ids(all(offset.searchQuery, offset.params)).slice(0, 3)).toEqual(expected.slice(2, 5));
    });
  });

  describe('dialectHelpers write queries', () => {
    const helpers = dialectHelpers('sqlite');

    test('INSERT', () => {
      const newUser = {
        id: 11,
        name: 'Kai Lee',
        email: 'kai@acme.io',
        status: 'PENDING',
        role: 'USER',
        age: 22,
        dept_id: 2,
        created_at: '2024-07-01',
      };
      const { columns, placeholders, params } = helpers.buildInsertValues(newUser);
      const info = db
        .prepare(`INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`)
        .run(...params);

      expect(info.changes).toBe(1);
      const { rows } = runUsers({ whereParams: [{ key: 'id', operation: 'EQ', value: 11 }] });
      expect(rows).toEqual([{ ...newUser, deleted_at: null }]);
    });

    test('UPDATE: SET placeholders continue into WHERE', () => {
      const where: Criteria[] = [
        { key: 'status', operation: 'EQ', value: 'ACTIVE' },
        { key: 'age', operation: 'LT', value: 31 },
      ];
      const { setClause, params } = helpers.buildSetClause({ status: 'INACTIVE', role: 'GUEST' });
      const { clause } = helpers.buildWhereClause(where, [], {}, params);
      const info = db.prepare(`UPDATE users SET ${setClause}${clause}`).run(...params);

      const targeted = USERS.filter((u) => u.status === 'ACTIVE' && u.age < 31).map((u) => u.id);
      expect(targeted).toEqual([2, 5, 6, 10]);
      expect(info.changes).toBe(targeted.length);

      const expectedState = USERS.map((u) =>
        targeted.includes(u.id) ? { ...u, status: 'INACTIVE', role: 'GUEST' } : u,
      );
      expect(runUsers({}).rows).toEqual(expectedState);
    });

    test('DELETE with text search (OR) and where (AND)', () => {
      const { clause, params } = helpers.buildWhereClause(
        [{ key: 'age', operation: 'GT', value: 20 }],
        [
          { key: 'status', operation: 'EQ', value: 'INACTIVE' },
          { key: 'status', operation: 'EQ', value: 'PENDING' },
        ],
      );
      const info = db.prepare(`DELETE FROM users${clause}`).run(...params);

      const doomed = (u: User) => ['INACTIVE', 'PENDING'].includes(u.status) && u.age > 20;
      expect(USERS.filter(doomed).map((u) => u.id)).toEqual([3, 7, 9]);
      expect(info.changes).toBe(3);
      expect(ids(runUsers({}).rows)).toEqual(USERS.filter((u) => !doomed(u)).map((u) => u.id));
    });
  });
});
