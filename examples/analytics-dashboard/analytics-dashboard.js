/**
 * Analytics Dashboard with GROUP BY and HAVING
 *
 * Demonstrates:
 * - Aggregation queries (COUNT, SUM, AVG)
 * - GROUP BY with proper count query handling
 * - HAVING clause for post-aggregation filtering
 * - modifyCountQuery for accurate pagination
 */

const { buildQueries } = require("sql-flex-query");

// Base template with GROUP BY
const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN order_items oi ON oi.order_id = o.id
  /*WHERE_CLAUSE*/
  GROUP BY c.id, c.name, c.email
  /*HAVING_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

// Column mapper with aggregated fields
const COLUMN_MAPPER = {
  customerName: "c.name",
  customerEmail: "c.email",
  orderCount: "COUNT(DISTINCT o.id)",
  totalSpent: "SUM(oi.quantity * oi.unit_price)",
  avgOrderValue: "AVG(oi.quantity * oi.unit_price)",
  firstOrderDate: "MIN(o.created_at)",
  lastOrderDate: "MAX(o.created_at)",
};

/**
 * Build customer analytics query
 * @param {Object} filters - Analytics filters
 * @param {string} [filters.startDate] - Start date for orders
 * @param {string} [filters.endDate] - End date for orders
 * @param {string[]} [filters.orderStatus] - Status filter (IN operation)
 * @param {number} [filters.minOrderCount] - Minimum orders (HAVING)
 * @param {number} [filters.minTotalSpent] - Minimum total spent (HAVING)
 * @param {string} [filters.sortBy='totalSpent'] - Sort field
 * @param {string} [filters.sortDir='DESC'] - Sort direction
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.size=20] - Page size
 * @param {string} [filters.dialect='postgres'] - SQL dialect
 * @returns {Object} Query result
 */
function buildCustomerAnalytics(filters = {}) {
  const {
    startDate,
    endDate,
    orderStatus = ["COMPLETED", "DELIVERED"],
    minOrderCount,
    minTotalSpent,
    sortBy = "totalSpent",
    sortDir = "DESC",
    page = 1,
    size = 20,
    dialect = "postgres",
  } = filters;

  // WHERE params (filter rows before GROUP BY)
  const whereParams = [];

  if (startDate) {
    whereParams.push({
      key: "orderDate",
      operation: "GTE",
      value: startDate,
    });
  }

  if (endDate) {
    whereParams.push({
      key: "orderDate",
      operation: "LTE",
      value: endDate,
    });
  }

  if (orderStatus && orderStatus.length > 0) {
    whereParams.push({
      key: "orderStatus",
      operation: "IN",
      value: orderStatus,
    });
  }

  // HAVING params (filter groups after GROUP BY)
  const havingParams = [];

  if (minOrderCount !== undefined) {
    havingParams.push({
      key: "orderCount",
      operation: "GTE",
      value: minOrderCount,
      having: true, // Mark as HAVING clause
    });
  }

  if (minTotalSpent !== undefined) {
    havingParams.push({
      key: "totalSpent",
      operation: "GTE",
      value: minTotalSpent,
      having: true, // Mark as HAVING clause
    });
  }

  return buildQueries({
    baseQueryTemplate: BASE,
    columnMapper: COLUMN_MAPPER,
    selectColumns: [
      "customerName",
      "customerEmail",
      "orderCount",
      "totalSpent",
      "avgOrderValue",
      "firstOrderDate",
      "lastOrderDate",
    ],
    whereParams,
    havingParams,
    sortBy: [{ key: sortBy, direction: sortDir }],
    page,
    size,
    dialect,
    // IMPORTANT: Wrap count query to count groups, not individual rows
    modifyCountQuery: (query) =>
      `SELECT COUNT(*) AS count FROM (${query}) AS grouped_count`,
  });
}

// Example 1: Top spending customers in 2024
const result1 = buildCustomerAnalytics({
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  orderStatus: ["COMPLETED", "DELIVERED"],
  minOrderCount: 5, // At least 5 orders
  minTotalSpent: 1000, // At least $1000 total
  sortBy: "totalSpent",
  sortDir: "DESC",
  page: 1,
  size: 10,
  dialect: "postgres",
});

console.log("=== Top Customers 2024 ===");
console.log("SQL:", result1.searchQuery);
console.log("Params:", result1.params);

// Example 2: Recent customers (last 30 days) for SQL Server
const result2 = buildCustomerAnalytics({
  startDate: "2024-12-01",
  endDate: "2024-12-31",
  minOrderCount: 1,
  sortBy: "lastOrderDate",
  sortDir: "DESC",
  page: 1,
  size: 50,
  dialect: "mssql",
});

console.log("\n=== Recent Customers (MSSQL) ===");
console.log("SQL:", result2.searchQuery);
console.log("Params:", result2.params);

/*
Key Insights:

1. WHERE vs HAVING:
   - WHERE filters individual rows BEFORE grouping
   - HAVING filters groups AFTER grouping
   - Set `having: true` to put a param in HAVING clause

2. modifyCountQuery:
   - With GROUP BY, COUNT(*) counts rows, not groups
   - Wrap the query to count groups correctly
   - Essential for accurate pagination

3. Aggregated Fields:
   - Use expressions like "COUNT(DISTINCT o.id)" in columnMapper
   - These become SELECT columns and can be used in HAVING

4. Multi-Dialect:
   - Same code works for postgres, mysql, mssql, oracle, etc.
   - Only change the dialect parameter
*/

module.exports = { buildCustomerAnalytics, COLUMN_MAPPER, BASE };