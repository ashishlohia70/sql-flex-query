# sql-flex-query

A lightweight, dialect-aware SQL query builder that enhances base query templates with dynamic WHERE, HAVING, ORDER BY, pagination, and more.

## Supported Databases

| Database | Placeholders | Identifier Quoting | Pagination |
|----------|-------------|-------------------|------------|
| PostgreSQL | `$1, $2` | `"double quotes"` | `LIMIT/OFFSET` |
| MySQL | `?` | backticks | `LIMIT/OFFSET` |
| SQLite | `?` | `"double quotes"` | `LIMIT/OFFSET` |
| SQL Server | `@p1, @p2` | `[brackets]` | `OFFSET/FETCH` |

## Installation

```bash
npm install sql-flex-query
```

---

## Basic Examples

### 1. Simple SELECT with WHERE and Pagination

```javascript
const { buildQueries } = require('sql-flex-query');

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

const result = buildQueries(
  BASE,
  [
    { key: 'status', operation: 'EQ', value: 'ACTIVE' },
    { key: 'age', operation: 'GTE', value: 18 },
  ],
  [],
  [{ key: 'createdAt', direction: 'DESC' }],
  1, 10,
  { createdAt: 'u.created_at' },
  ['id', 'name', 'email', 'createdAt']
);
// searchQuery: SELECT u.id AS "id", ... WHERE "status" = $1 AND u.created_at >= $2 ORDER BY ... LIMIT 10 OFFSET 0
// params: ['ACTIVE', 18]
```

### 2. Text Search (OR) + Filters (AND)

```javascript
const result = buildQueries({
  baseQueryTemplate: `
    SELECT /*SELECT_COLUMNS*/
    FROM products p
    /*WHERE_CLAUSE*/
    /*ORDER_BY*/
    /*LIMIT_CLAUSE*/
  `,
  textSearchParams: [
    { key: 'name', operation: 'LIKE', value: '%laptop%', ignoreCase: true },
    { key: 'description', operation: 'LIKE', value: '%laptop%', ignoreCase: true },
  ],
  whereParams: [
    { key: 'status', operation: 'EQ', value: 'PUBLISHED' },
    { key: 'price', operation: 'LTE', value: 2000 },
    { key: 'deleted_at', operation: 'NULL' },
  ],
  sortBy: [{ key: 'price', direction: 'ASC' }],
  page: 1,
  size: 20,
  dialect: 'postgres',
});
// WHERE (LOWER("name") LIKE $1 OR LOWER("description") LIKE $2)
//   AND "status" = $3 AND "price" <= $4 AND "deleted_at" IS NULL
// params: ['%laptop%', '%laptop%', 'PUBLISHED', 2000]
```

---

## Complex Examples

### 3. Multi-table JOIN with Column Mapping

```javascript
const { buildQueries } = require('sql-flex-query');

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

const columnMapper = {
  orderId:       'o.id',
  orderDate:     'o.created_at',
  orderStatus:   'o.status',
  customerName:  'c.name',
  customerEmail: 'c.email',
  productName:   'p.name',
  quantity:      'oi.quantity',
  unitPrice:     'oi.unit_price',
};

const result = buildQueries({
  baseQueryTemplate: BASE,
  columnMapper,
  selectColumns: [
    'orderId', 'orderDate', 'orderStatus',
    'customerName', 'customerEmail',
    'productName', 'quantity', 'unitPrice',
  ],
  whereParams: [
    { key: 'orderStatus', operation: 'IN', value: ['SHIPPED', 'DELIVERED'] },
    { key: 'orderDate', operation: 'GTE', value: '2024-01-01' },
    { key: 'orderDate', operation: 'LTE', value: '2024-12-31' },
    { key: 'unitPrice', operation: 'GT', value: 0 },
  ],
  textSearchParams: [
    { key: 'customerName', operation: 'LIKE', value: '%john%', ignoreCase: true },
    { key: 'customerEmail', operation: 'LIKE', value: '%john%', ignoreCase: true },
    { key: 'productName', operation: 'LIKE', value: '%john%', ignoreCase: true },
  ],
  sortBy: [
    { key: 'orderDate', direction: 'DESC' },
    { key: 'customerName', direction: 'ASC' },
  ],
  page: 1,
  size: 25,
  dialect: 'postgres',
});

// searchQuery:
// SELECT o.id AS "orderId", o.created_at AS "orderDate", o.status AS "orderStatus",
//        c.name AS "customerName", c.email AS "customerEmail",
//        p.name AS "productName", oi.quantity AS "quantity", oi.unit_price AS "unitPrice"
// FROM orders o
// JOIN customers c ON c.id = o.customer_id
// JOIN order_items oi ON oi.order_id = o.id
// JOIN products p ON p.id = oi.product_id
// WHERE (LOWER(c.name) LIKE $1 OR LOWER(c.email) LIKE $2 OR LOWER(p.name) LIKE $3)
//   AND o.status IN ($4, $5)
//   AND o.created_at >= $6 AND o.created_at <= $7
//   AND oi.unit_price > $8
// ORDER BY o.created_at DESC, c.name ASC
// LIMIT 25 OFFSET 0
//
// params: ['%john%', '%john%', '%john%', 'SHIPPED', 'DELIVERED', '2024-01-01', '2024-12-31', 0]
```

### 4. GROUP BY + HAVING (Aggregation Reports)

```javascript
const { buildQueries } = require('sql-flex-query');

// GROUP BY is part of the template.
// The builder handles WHERE (before GROUP BY) and HAVING (after GROUP BY) automatically.
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

const columnMapper = {
  customerName:  'c.name',
  customerEmail: 'c.email',
  orderCount:    'COUNT(DISTINCT o.id)',
  totalSpent:    'SUM(oi.quantity * oi.unit_price)',
  avgOrderValue: 'AVG(oi.quantity * oi.unit_price)',
  orderDate:     'o.created_at',
  orderStatus:   'o.status',
};

const result = buildQueries({
  baseQueryTemplate: BASE,
  columnMapper,
  selectColumns: ['customerName', 'customerEmail', 'orderCount', 'totalSpent', 'avgOrderValue'],
  whereParams: [
    // WHERE filters — applied BEFORE GROUP BY
    { key: 'orderStatus', operation: 'IN', value: ['COMPLETED', 'DELIVERED'] },
    { key: 'orderDate', operation: 'GTE', value: '2024-01-01' },
    { key: 'orderDate', operation: 'LTE', value: '2024-12-31' },

    // HAVING filters — set having: true — applied AFTER GROUP BY
    { key: 'orderCount', operation: 'GTE', value: 5, having: true },
    { key: 'totalSpent', operation: 'GTE', value: 1000, having: true },
  ],
  sortBy: [{ key: 'totalSpent', direction: 'DESC' }],
  page: 1,
  size: 10,
  dialect: 'postgres',
});

// searchQuery:
// SELECT c.name AS "customerName", c.email AS "customerEmail",
//        COUNT(DISTINCT o.id) AS "orderCount",
//        SUM(oi.quantity * oi.unit_price) AS "totalSpent",
//        AVG(oi.quantity * oi.unit_price) AS "avgOrderValue"
// FROM orders o
// JOIN customers c ON c.id = o.customer_id
// JOIN order_items oi ON oi.order_id = o.id
// WHERE o.status IN ($1, $2) AND o.created_at >= $3 AND o.created_at <= $4
// GROUP BY c.id, c.name, c.email
// HAVING COUNT(DISTINCT o.id) >= $5 AND SUM(oi.quantity * oi.unit_price) >= $6
// ORDER BY SUM(oi.quantity * oi.unit_price) DESC
// LIMIT 10 OFFSET 0
//
// params: ['COMPLETED', 'DELIVERED', '2024-01-01', '2024-12-31', 5, 1000]
```

### 5. GROUP BY with modifyCountQuery

When using GROUP BY, the default COUNT gives wrong results. Use modifyCountQuery to wrap the count:

```javascript
const BASE_WITH_GROUP = `
  SELECT /*SELECT_COLUMNS*/
  FROM app_messages msg
  LEFT JOIN app_locations loc ON msg.location_id = loc.id
  JOIN app_tasks task ON task.id = msg.task_id
  JOIN app_task_case_link tcl ON tcl.task_id = task.id
  JOIN (
    SELECT DISTINCT task_id, case_ref, org_code
    FROM app_case_snapshot WHERE is_current = true
  ) cs ON cs.task_id = tcl.task_id AND cs.case_ref = tcl.case_ref
  /*WHERE_CLAUSE*/
  GROUP BY DATE(task.created_at), cs.org_code, msg.is_structured
  /*HAVING_CLAUSE*/
  /*ORDER_BY*/ /*LIMIT_CLAUSE*/
`;

const columnMapper = {
  createdDate: 'DATE(task.created_at)',
  organizationCode: 'cs.org_code',
  structured:  'msg.is_structured',
  messageCount:  'COUNT(msg.id)',
  locationName:  'loc.display_name',
  state:      'msg.state',
};

const result = buildQueries({
  baseQueryTemplate: BASE_WITH_GROUP,
  columnMapper,
  selectColumns: ['createdDate', 'organizationCode', 'structured', 'messageCount'],
  whereParams: [
    { key: 'state', operation: 'EQ', value: 'PROCESSED' },
    { key: 'locationName', operation: 'NOT_NULL' },
    { key: 'messageCount', operation: 'GT', value: 10, having: true },
  ],
  sortBy: [
    { key: 'createdDate', direction: 'DESC' },
    { key: 'messageCount', direction: 'DESC' },
  ],
  page: 1,
  size: 20,
  dialect: 'postgres',
  // Wrap count query to count groups, not rows within groups
  modifyCountQuery: (query) => `SELECT COUNT(*) AS count FROM (${query}) AS grouped_count`,
});

// countQuery:
// SELECT COUNT(*) AS count FROM (
//   SELECT 1 FROM app_messages msg
//   LEFT JOIN app_locations loc ON msg.location_id = loc.id
//   JOIN app_tasks task ON task.id = msg.task_id
//   JOIN app_task_case_link tcl ON tcl.task_id = task.id
//   JOIN (
//     SELECT DISTINCT task_id, case_ref, org_code
//     FROM app_case_snapshot WHERE is_current = true
//   ) cs ON cs.task_id = tcl.task_id AND cs.case_ref = tcl.case_ref
//   WHERE msg.state = $1 AND loc.display_name IS NOT NULL
//   GROUP BY DATE(task.created_at), cs.org_code, msg.is_structured
//   HAVING COUNT(msg.id) > $2
// ) AS grouped_count
```

### 6. LEFT JOIN + DISTINCT (Fluent API)

```javascript
const { QueryBuilder } = require('sql-flex-query');

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employee_skills es ON es.employee_id = e.id
  LEFT JOIN skills s ON s.id = es.skill_id
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

const result = new QueryBuilder('postgres')
  .baseQuery(BASE)
  .columnMapper({
    employeeId:     'e.id',
    employeeName:   'e.name',
    employeeEmail:  'e.email',
    departmentName: 'd.name',
    hireDate:       'e.hire_date',
    salary:         'e.salary',
    skillName:      's.name',
  })
  .select(['employeeId', 'employeeName', 'employeeEmail', 'departmentName'])
  .distinct()
  .where([
    { key: 'departmentName', operation: 'IN', value: ['Engineering', 'Product', 'Design'] },
    { key: 'hireDate', operation: 'GTE', value: '2023-01-01' },
    { key: 'salary', operation: 'GTE', value: 50000 },
    { key: 'salary', operation: 'LTE', value: 150000 },
  ])
  .textSearch([
    { key: 'employeeName', operation: 'LIKE', value: '%sarah%', ignoreCase: true },
    { key: 'employeeEmail', operation: 'LIKE', value: '%sarah%', ignoreCase: true },
    { key: 'skillName', operation: 'LIKE', value: '%sarah%', ignoreCase: true },
  ])
  .orderBy([
    { key: 'departmentName', direction: 'ASC' },
    { key: 'employeeName', direction: 'ASC' },
  ])
  .paginate(2, 15)
  .build();

// searchQuery:
// SELECT DISTINCT e.id AS "employeeId", e.name AS "employeeName",
//        e.email AS "employeeEmail", d.name AS "departmentName"
// FROM employees e
// LEFT JOIN departments d ON d.id = e.department_id
// LEFT JOIN employee_skills es ON es.employee_id = e.id
// LEFT JOIN skills s ON s.id = es.skill_id
// WHERE (LOWER(e.name) LIKE $1 OR LOWER(e.email) LIKE $2 OR LOWER(s.name) LIKE $3)
//   AND d.name IN ($4, $5, $6)
//   AND e.hire_date >= $7 AND e.salary >= $8 AND e.salary <= $9
// ORDER BY d.name ASC, e.name ASC
// LIMIT 15 OFFSET 15
//
// params: ['%sarah%', '%sarah%', '%sarah%', 'Engineering', 'Product', 'Design',
//          '2023-01-01', 50000, 150000]
```

### 7. Sales Dashboard (Fluent API + GROUP BY + HAVING + MSSQL)

```javascript
const { QueryBuilder } = require('sql-flex-query');

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM sales s
  JOIN sales_reps sr ON sr.id = s.rep_id
  JOIN regions r ON r.id = sr.region_id
  JOIN products p ON p.id = s.product_id
  JOIN product_categories pc ON pc.id = p.category_id
  /*WHERE_CLAUSE*/
  GROUP BY r.name, sr.name, pc.name, YEAR(s.sale_date), MONTH(s.sale_date)
  /*HAVING_CLAUSE*/
  /*ORDER_BY*/ /*LIMIT_CLAUSE*/
`;

const result = new QueryBuilder('mssql')
  .baseQuery(BASE)
  .columnMapper({
    regionName:   'r.name',
    repName:      'sr.name',
    categoryName: 'pc.name',
    saleYear:     'YEAR(s.sale_date)',
    saleMonth:    'MONTH(s.sale_date)',
    totalRevenue: 'SUM(s.amount)',
    totalUnits:   'SUM(s.quantity)',
    dealCount:    'COUNT(s.id)',
    avgDealSize:  'AVG(s.amount)',
    saleDate:     's.sale_date',
    saleStatus:   's.status',
  })
  .select([
    'regionName', 'repName', 'categoryName',
    'saleYear', 'saleMonth',
    'totalRevenue', 'totalUnits', 'dealCount', 'avgDealSize',
  ])
  .where([
    { key: 'saleDate', operation: 'GTE', value: '2024-01-01' },
    { key: 'saleDate', operation: 'LTE', value: '2024-12-31' },
    { key: 'saleStatus', operation: 'EQ', value: 'CLOSED_WON' },
    { key: 'regionName', operation: 'IN', value: ['North America', 'Europe', 'APAC'] },
  ])
  .having([
    { key: 'totalRevenue', operation: 'GTE', value: 50000 },
    { key: 'dealCount', operation: 'GTE', value: 3 },
  ])
  .orderBy([
    { key: 'totalRevenue', direction: 'DESC' },
    { key: 'regionName', direction: 'ASC' },
  ])
  .paginate(1, 20)
  .modifyCountQuery((query) => `SELECT COUNT(*) AS count FROM (${query}) AS t`)
  .build();

// searchQuery (SQL Server):
// SELECT r.name AS [regionName], sr.name AS [repName], pc.name AS [categoryName],
//        YEAR(s.sale_date) AS [saleYear], MONTH(s.sale_date) AS [saleMonth],
//        SUM(s.amount) AS [totalRevenue], SUM(s.quantity) AS [totalUnits],
//        COUNT(s.id) AS [dealCount], AVG(s.amount) AS [avgDealSize]
// FROM sales s
// JOIN sales_reps sr ON sr.id = s.rep_id
// JOIN regions r ON r.id = sr.region_id
// JOIN products p ON p.id = s.product_id
// JOIN product_categories pc ON pc.id = p.category_id
// WHERE s.sale_date >= @p1 AND s.sale_date <= @p2
//   AND s.status = @p3 AND r.name IN (@p4, @p5, @p6)
// GROUP BY r.name, sr.name, pc.name, YEAR(s.sale_date), MONTH(s.sale_date)
// HAVING SUM(s.amount) >= @p7 AND COUNT(s.id) >= @p8
// ORDER BY SUM(s.amount) DESC, r.name ASC OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
//
// params: ['2024-01-01', '2024-12-31', 'CLOSED_WON',
//          'North America', 'Europe', 'APAC', 50000, 3]
```

### 8. Subquery JOIN with MySQL (Fluent API)

```javascript
const { QueryBuilder } = require('sql-flex-query');

const BASE = `
  SELECT /*SELECT_COLUMNS*/
  FROM users u
  JOIN (
    SELECT user_id,
           COUNT(*) as login_count,
           MAX(login_at) as last_login
    FROM login_history
    WHERE login_at >= '2024-01-01'
    GROUP BY user_id
  ) lh ON lh.user_id = u.id
  LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.is_active = true
  LEFT JOIN plans p ON p.id = us.plan_id
  /*WHERE_CLAUSE*/
  /*ORDER_BY*/
  /*LIMIT_CLAUSE*/
`;

const result = new QueryBuilder('mysql')
  .baseQuery(BASE)
  .columnMapper({
    userId:      'u.id',
    userName:    'u.name',
    userEmail:   'u.email',
    loginCount:  'lh.login_count',
    lastLogin:   'lh.last_login',
    planName:    'p.name',
    userStatus:  'u.status',
    userRole:    'u.role',
  })
  .select(['userId', 'userName', 'userEmail', 'loginCount', 'lastLogin', 'planName'])
  .where([
    { key: 'userStatus', operation: 'EQ', value: 'ACTIVE' },
    { key: 'loginCount', operation: 'GTE', value: 10 },
    { key: 'userRole', operation: 'IN', value: ['ADMIN', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'planName', operation: 'NOT_NULL' },
  ])
  .textSearch([
    { key: 'userName', operation: 'LIKE', value: '%search_term%', ignoreCase: true },
    { key: 'userEmail', operation: 'LIKE', value: '%search_term%', ignoreCase: true },
  ])
  .orderBy([
    { key: 'loginCount', direction: 'DESC' },
    { key: 'lastLogin', direction: 'DESC' },
  ])
  .paginate(1, 50)
  .build();

// searchQuery (MySQL):
// SELECT u.id AS \`userId\`, u.name AS \`userName\`, u.email AS \`userEmail\`,
//        lh.login_count AS \`loginCount\`, lh.last_login AS \`lastLogin\`,
//        p.name AS \`planName\`
// FROM users u
// JOIN (...) lh ON lh.user_id = u.id
// LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.is_active = true
// LEFT JOIN plans p ON p.id = us.plan_id
// WHERE (\`userName\` LIKE ? OR \`userEmail\` LIKE ?)
//   AND u.status = ? AND lh.login_count >= ?
//   AND u.role IN (?, ?, ?) AND p.name IS NOT NULL
// ORDER BY lh.login_count DESC, lh.last_login DESC
// LIMIT 50 OFFSET 0
//
// params: ['%search_term%', '%search_term%', 'ACTIVE', 10, 'ADMIN', 'PREMIUM', 'ENTERPRISE']
```

---

## Template Placeholders Reference

| Placeholder | Required | Description |
|-------------|----------|-------------|
| `/*SELECT_COLUMNS*/` | Yes | Replaced with column list or `*` |
| `/*WHERE_CLAUSE*/` | Yes | Replaced with `WHERE ...` or empty string |
| `/*ORDER_BY*/` | Yes | Replaced with `ORDER BY ...` or empty string |
| `/*LIMIT_CLAUSE*/` | Yes | Replaced with pagination clause or empty string |
| `/*HAVING_CLAUSE*/` | Optional | Replaced with `HAVING ...` (use with GROUP BY) |

---

## Operations Reference

| Operation | SQL | Needs Value | Example |
|-----------|-----|-------------|---------|
| `EQ` | `col = ?` | Yes | `{ key: 'status', operation: 'EQ', value: 'ACTIVE' }` |
| `NEQ` | `col <> ?` | Yes | `{ key: 'role', operation: 'NEQ', value: 'GUEST' }` |
| `LIKE` | `col LIKE ?` | Yes | `{ key: 'name', operation: 'LIKE', value: '%john%' }` |
| `NOT_LIKE` | `col NOT LIKE ?` | Yes | `{ key: 'email', operation: 'NOT_LIKE', value: '%spam%' }` |
| `GT` | `col > ?` | Yes | `{ key: 'age', operation: 'GT', value: 18 }` |
| `LT` | `col < ?` | Yes | `{ key: 'price', operation: 'LT', value: 100 }` |
| `GTE` | `col >= ?` | Yes | `{ key: 'score', operation: 'GTE', value: 90 }` |
| `LTE` | `col <= ?` | Yes | `{ key: 'weight', operation: 'LTE', value: 80 }` |
| `IN` | `col IN (?, ?)` | Yes (array) | `{ key: 'status', operation: 'IN', value: ['A', 'B'] }` |
| `NULL` | `col IS NULL` | No | `{ key: 'deleted_at', operation: 'NULL' }` |
| `NOT_NULL` | `col IS NOT NULL` | No | `{ key: 'verified_at', operation: 'NOT_NULL' }` |

---

## License

MIT
