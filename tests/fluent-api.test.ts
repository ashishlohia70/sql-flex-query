import { describe, test, expect } from 'vitest';
import { QueryBuilder } from '../src';

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*HAVING_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

describe('QueryBuilder fluent API', () => {
  test('Simple query with all options', () => {
    const result = new QueryBuilder('postgres')
      .baseQuery(BASE)
      .columnMapper({ name: 'u.name', email: 'u.email' })
      .select(['name', 'email'])
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .textSearch([
        { key: 'name', operation: 'LIKE', value: '%john%', ignoreCase: true },
      ])
      .orderBy({ key: 'name', direction: 'ASC' })
      .paginate(1, 10)
      .build();
    expect(result.params).toEqual(['%john%', 'ACTIVE']);
    expect(result.searchQuery).toContain('u.name AS "name"');
    expect(result.searchQuery).toContain('LIMIT 10 OFFSET 0');
  });

  test('Multiple where() calls are ANDed', () => {
    const result = new QueryBuilder('postgres')
      .baseQuery(BASE)
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .where({ key: 'age', operation: 'GT', value: 18 })
      .build();
    expect(result.params).toEqual(['ACTIVE', 18]);
    expect(result.searchQuery).toContain('$1');
    expect(result.searchQuery).toContain('$2');
  });

  test('having() sets having flag automatically', () => {
    const result = new QueryBuilder('postgres')
      .baseQuery(BASE)
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .having({ key: 'count', operation: 'GT', value: 5 })
      .build();
    expect(result.params).toEqual(['ACTIVE', 5]);
    expect(result.searchQuery).toContain('WHERE');
    expect(result.searchQuery).toContain('HAVING');
  });

  test('distinct() enables DISTINCT', () => {
    const result = new QueryBuilder('mysql')
      .baseQuery(BASE)
      .select(['name', 'email'])
      .distinct()
      .build();
    expect(result.searchQuery).toContain('DISTINCT');
  });

  test('build() without baseQuery() throws', () => {
    expect(() => {
      new QueryBuilder('postgres').build();
    }).toThrow('baseQuery() must be called before build()');
  });

  test('reset() clears all state', () => {
    const builder = new QueryBuilder('postgres')
      .baseQuery(BASE)
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .paginate(1, 10);
    builder.reset();
    expect(() => builder.build()).toThrow();
  });

  test('sortBy() shorthand works', () => {
    const result = new QueryBuilder('postgres')
      .baseQuery(BASE)
      .sortBy('name', 'DESC')
      .sortBy('id', 'ASC')
      .build();
    expect(result.searchQuery).toContain('ORDER BY "name" DESC, "id" ASC');
  });

  test('Cross-dialect fluent usage (MSSQL)', () => {
    const result = new QueryBuilder('mssql')
      .baseQuery(BASE)
      .where({ key: 'status', operation: 'EQ', value: 'ACTIVE' })
      .sortBy('id', 'ASC')
      .paginate(1, 20)
      .build();
    expect(result.searchQuery).toContain('@p1');
    expect(result.searchQuery).toContain('OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY');
  });
});
