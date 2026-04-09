import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../src';

describe('QueryBuilder BETWEEN operation', () => {
  it('generates correct PostgreSQL syntax with QueryBuilder for BETWEEN operation', () => {
    const result = new QueryBuilder('postgres')
      .baseQuery('SELECT /*SELECT_COLUMNS*/ FROM users /*WHERE_CLAUSE*/')
      .where({ key: 'age', operation: 'BETWEEN', value: [18, 65] })
      .select(['id', 'name'])
      .build();

    expect(result.searchQuery).toContain('"age" >= $1 AND "age" <= $2');
    expect(result.params).toEqual([18, 65]);
  });

  it('generates correct MySQL syntax with QueryBuilder for BETWEEN operation', () => {
    const result = new QueryBuilder('mysql')
      .baseQuery('SELECT /*SELECT_COLUMNS*/ FROM products /*WHERE_CLAUSE*/')
      .where({ key: 'price', operation: 'BETWEEN', value: [100, 1000] })
      .select(['id', 'name'])
      .build();

    expect(result.searchQuery).toContain('`price` >= ? AND `price` <= ?');
    expect(result.params).toEqual([100, 1000]);
  });

  it('throws error when BETWEEN value is not an array in QueryBuilder', () => {
    expect(() => {
      new QueryBuilder('postgres')
        .baseQuery('SELECT /*SELECT_COLUMNS*/ FROM users /*WHERE_CLAUSE*/')
        .where({ key: 'age', operation: 'BETWEEN', value: 18 })
        .select(['id', 'name'])
        .build();
    }).toThrow('BETWEEN operation requires an array of two values.');
  });
});