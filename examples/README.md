# Examples

This directory contains real-world examples of using `sql-flex-query` in various scenarios.

## Examples

### 1. E-Commerce Search ([`ecommerce-search/ecommerce-search.js`](ecommerce-search/ecommerce-search.js))

A complete product search API implementation featuring:
- Full-text search across product name and description (OR conditions)
- Category, price range, and availability filters (AND conditions)
- Dynamic sorting and pagination
- Column mapping for clean code
- Multi-dialect support (PostgreSQL, MySQL, SQL Server, etc.)

**Key concepts**: `textSearchParams`, `whereParams`, `columnMapper`, pagination

**Run it**:
```bash
node ecommerce-search/ecommerce-search.js
```

### 2. Analytics Dashboard with GROUP BY ([`analytics-dashboard/analytics-dashboard.js`](analytics-dashboard/analytics-dashboard.js))

Customer analytics with aggregation:
- GROUP BY with COUNT, SUM, AVG
- HAVING clause for post-aggregation filtering
- `modifyCountQuery` for accurate pagination with GROUP BY
- Date range filtering
- Multi-dialect support

**Key concepts**: `GROUP BY`, `HAVING`, `modifyCountQuery`, aggregated fields

**Run it**:
```bash
node analytics-dashboard/analytics-dashboard.js
```

### 3. Advanced Fluent API ([`fluent-api-advanced/fluent-api-advanced.js`](fluent-api-advanced/fluent-api-advanced.js))

Employee search using the `QueryBuilder` class:
- Dynamic filter building (conditions added programmatically)
- Complex JOINs with LEFT JOINs and DISTINCT
- Array-based IN operations
- Conditional clause addition
- TypeScript-friendly

**Key concepts**: `QueryBuilder`, method chaining, dynamic queries, `.distinct()`

**Run it**:
```bash
node fluent-api-advanced/fluent-api-advanced.js
```

## Running the Examples

Each example is a standalone Node.js script. Simply run:

```bash
cd examples/<example-name>
node <example-file>.js
```

Or run all at once:

```bash
for dir in */; do
  echo "=== Running $dir ==="
  (cd "$dir" && node *.js)
done
```

## Testing with Different Dialects

To test an example with a different database dialect, simply change the `dialect` parameter:

```javascript
const result = buildQueries({
  // ... other params
  dialect: "mysql", // Change to: postgres, mysql, sqlite, mssql, oracle, cockroach, snowflake
});
```

Each example demonstrates output for multiple dialects.

## Adding Your Own Examples

We welcome contributions! If you've built something cool with `sql-flex-query`, consider adding it to the examples directory.

Guidelines:
- Include clear comments explaining the use case
- Show at least 2 dialects if using dialect-specific features
- Add a README.md explaining what your example demonstrates
- Keep examples production-realistic (not too trivial)

## Common Patterns

These examples demonstrate recurring patterns:

1. **Column Mapping**: Use semantic names in your code, map to actual DB columns
2. **Text Search**: Use `textSearchParams` for OR conditions across multiple fields
3. **Filters**: Use `whereParams` for AND conditions
4. **Dynamic Building**: Build arrays conditionally based on user input
5. **Pagination**: Always include `page` and `size` for list endpoints
6. **Type Safety**: Leverage TypeScript generics with columnMapper

## Need Help?

- Check the main [README.md](../README.md) for API documentation
- See [Operations Reference](../README.md#operations-reference) for all supported operations
- Open an [issue](https://github.com/ashishlohia70/sql-flex-query/issues) if you get stuck

## License

These examples are provided under the same MIT license as the main library.