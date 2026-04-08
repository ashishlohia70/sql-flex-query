/**
 * E-Commerce Product Search Example
 *
 * Demonstrates how to build a flexible product search API with:
 * - Text search across multiple fields
 * - Dynamic filters (category, price range, availability)
 * - Sorting and pagination
 * - Multi-dialect support
 */

const { buildQueries } = require("sql-flex-query");

// Base SQL template with placeholders
const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM products p
  JOIN categories c ON c.id = p.category_id
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

// Column mapping for clean, semantic code
const COLUMN_MAPPER = {
  productId: "p.id",
  productName: "p.name",
  description: "p.description",
  price: "p.price",
  inStock: "p.stock_quantity > 0",
  categoryName: "c.name",
  createdAt: "p.created_at",
};

/**
 * Build product search query based on filters
 * @param {Object} filters - Search filters
 * @param {string} [filters.searchTerm] - Text to search in name/description
 * @param {string} [filters.category] - Category filter
 * @param {number} [filters.minPrice] - Minimum price
 * @param {number} [filters.maxPrice] - Maximum price
 * @param {boolean} [filters.inStockOnly=true] - Only show in-stock items
 * @param {string} [filters.sortBy='createdAt'] - Sort field
 * @param {string} [filters.sortDir='DESC'] - Sort direction (ASC/DESC)
 * @param {number} [filters.page=1] - Page number (1-indexed)
 * @param {number} [filters.size=20] - Items per page
 * @param {string} [filters.dialect='postgres'] - SQL dialect
 * @returns {Object} Query result with SQL and params
 */
function buildProductSearch(filters = {}) {
  const {
    searchTerm,
    category,
    minPrice,
    maxPrice,
    inStockOnly = true,
    sortBy = "createdAt",
    sortDir = "DESC",
    page = 1,
    size = 20,
    dialect = "postgres",
  } = filters;

  // Build text search params (OR condition)
  const textSearchParams = searchTerm
    ? [
        {
          key: "productName",
          operation: "LIKE",
          value: `%${searchTerm}%`,
          ignoreCase: true,
        },
        {
          key: "description",
          operation: "LIKE",
          value: `%${searchTerm}%`,
          ignoreCase: true,
        },
      ]
    : [];

  // Build WHERE params (AND condition)
  const whereParams = [];

  if (category) {
    whereParams.push({
      key: "categoryName",
      operation: "EQ",
      value: category,
    });
  }

  if (minPrice !== undefined) {
    whereParams.push({
      key: "price",
      operation: "GTE",
      value: minPrice,
    });
  }

  if (maxPrice !== undefined) {
    whereParams.push({
      key: "price",
      operation: "LTE",
      value: maxPrice,
    });
  }

  if (inStockOnly) {
    whereParams.push({
      key: "inStock",
      operation: "EQ",
      value: true,
    });
  }

  return buildQueries({
    baseQueryTemplate: BASE,
    columnMapper: COLUMN_MAPPER,
    selectColumns: [
      "productId",
      "productName",
      "description",
      "price",
      "categoryName",
      "createdAt",
    ],
    textSearchParams,
    whereParams,
    sortBy: [{ key: sortBy, direction: sortDir }],
    page,
    size,
    dialect,
  });
}

// Example usage
const filters = {
  searchTerm: "laptop",
  category: "Electronics",
  minPrice: 500,
  maxPrice: 2000,
  inStockOnly: true,
  sortBy: "price",
  sortDir: "ASC",
  page: 1,
  size: 20,
  dialect: "postgres",
};

const result = buildProductSearch(filters);

console.log("Generated SQL:");
console.log(result.searchQuery);
console.log("\nParameters:", result.params);
console.log("\nCount query:", result.countQuery);

// Output for PostgreSQL:
// SELECT p.id AS "productId", p.name AS "productName", p.description AS "description",
//        p.price AS "price", c.name AS "categoryName", p.created_at AS "createdAt"
// FROM products p
// JOIN categories c ON c.id = p.category_id
// WHERE (LOWER(p.name) LIKE $1 OR LOWER(p.description) LIKE $2)
//   AND c.name = $3
//   AND p.price >= $4 AND p.price <= $5
//   AND p.stock_quantity > 0 = true
// ORDER BY price ASC
// LIMIT 20 OFFSET 0
//
// Parameters: ['%laptop%', '%laptop%', 'Electronics', 500, 2000]

module.exports = { buildProductSearch, COLUMN_MAPPER, BASE };