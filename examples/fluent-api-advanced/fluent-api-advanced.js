/**
 * Advanced Fluent API Example
 *
 * Demonstrates the QueryBuilder class for programmatic query construction.
 * Perfect for dynamic filters where you don't know the conditions ahead of time.
 */

const { QueryBuilder } = require("sql-flex-query");

// Complex base query with multiple JOINs
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

// Column mapper
const COLUMN_MAPPER = {
  employeeId: "e.id",
  employeeName: "e.name",
  employeeEmail: "e.email",
  departmentName: "d.name",
  hireDate: "e.hire_date",
  salary: "e.salary",
  skillName: "s.name",
};

/**
 * Build employee search with dynamic filters
 * @param {Object} criteria - Search criteria
 * @returns {Object} Built query
 */
function buildEmployeeSearch(criteria = {}) {
  const {
    department, // string or array
    minSalary,
    maxSalary,
    minHireDate,
    maxHireDate,
    skills, // array of skills to match (OR)
    nameSearch, // text search in name/email
    includeInactive = false,
    page = 1,
    size = 20,
    dialect = "postgres",
  } = criteria;

  const builder = new QueryBuilder(dialect)
    .baseQuery(BASE)
    .columnMapper(COLUMN_MAPPER)
    .select([
      "employeeId",
      "employeeName",
      "employeeEmail",
      "departmentName",
      "hireDate",
      "salary",
    ])
    .distinct(); // Use DISTINCT because of LEFT JOINs

  // Build WHERE conditions dynamically
  const whereConditions = [];

  if (department) {
    if (Array.isArray(department)) {
      whereConditions.push({
        key: "departmentName",
        operation: "IN",
        value: department,
      });
    } else {
      whereConditions.push({
        key: "departmentName",
        operation: "EQ",
        value: department,
      });
    }
  }

  if (minSalary !== undefined) {
    whereConditions.push({
      key: "salary",
      operation: "GTE",
      value: minSalary,
    });
  }

  if (maxSalary !== undefined) {
    whereConditions.push({
      key: "salary",
      operation: "LTE",
      value: maxSalary,
    });
  }

  if (minHireDate) {
    whereConditions.push({
      key: "hireDate",
      operation: "GTE",
      value: minHireDate,
    });
  }

  if (maxHireDate) {
    whereConditions.push({
      key: "hireDate",
      operation: "LTE",
      value: maxHireDate,
    });
  }

  if (!includeInactive) {
    whereConditions.push({
      key: "isActive",
      operation: "EQ",
      value: true,
    });
  }

  if (whereConditions.length > 0) {
    builder.where(whereConditions);
  }

  // Text search across name, email, and skills
  if (nameSearch) {
    builder.textSearch([
      {
        key: "employeeName",
        operation: "LIKE",
        value: `%${nameSearch}%`,
        ignoreCase: true,
      },
      {
        key: "employeeEmail",
        operation: "LIKE",
        value: `%${nameSearch}%`,
        ignoreCase: true,
      },
      {
        key: "skillName",
        operation: "LIKE",
        value: `%${nameSearch}%`,
        ignoreCase: true,
      },
    ]);
  }

  // Filter by skills (only show employees with ALL specified skills)
  // This requires multiple conditions that must ALL match
  if (skills && skills.length > 0) {
    // For each skill, add a condition
    // Note: This is a simplified approach. For exact "has all skills",
    // you'd need GROUP BY + HAVING COUNT(DISTINCT s.id) = skills.length
    const skillConditions = skills.map((skill) => ({
      key: "skillName",
      operation: "EQ",
      value: skill,
    }));
    builder.where(skillConditions);
  }

  // Order by
  builder.orderBy([
    { key: "departmentName", direction: "ASC" },
    { key: "employeeName", direction: "ASC" },
  ]);

  // Pagination
  builder.paginate(page, size);

  return builder.build();
}

// Example 1: Search for engineers in Engineering or Product departments
const result1 = buildEmployeeSearch({
  department: ["Engineering", "Product", "Design"],
  minSalary: 100000,
  minHireDate: "2020-01-01",
  nameSearch: "sarah",
  page: 1,
  size: 15,
  dialect: "postgres",
});

console.log("=== Employee Search (PostgreSQL) ===");
console.log("Query:", result1.searchQuery);
console.log("Params:", result1.params);
console.log("Count Query:", result1.countQuery);

// Example 2: High-salary employees in SQL Server
const result2 = buildEmployeeSearch({
  minSalary: 150000,
  maxSalary: 250000,
  department: "Engineering",
  includeInactive: false,
  page: 1,
  size: 50,
  dialect: "mssql",
});

console.log("\n=== High-Salary Engineers (MSSQL) ===");
console.log("Query:", result2.searchQuery);
console.log("Params:", result2.params);

/*
Key Fluent API Features Demonstrated:

1. Method Chaining:
   - Each method returns `this` for chaining
   - Readable, expressive syntax

2. Dynamic Building:
   - Conditionally add .where(), .textSearch(), .orderBy()
   - Perfect for API endpoints with optional filters

3. .distinct():
   - Essential when using LEFT JOINs to avoid duplicates
   - Adds DISTINCT to SELECT

4. .paginate(page, size):
   - Convenient method for pagination
   - Handles dialect-specific syntax automatically

5. .build():
   - Returns { searchQuery, params, countQuery }
   - Same output format as buildQueries()

6. Dialect Support:
   - Works with all 7 supported dialects
   - Just change the dialect in constructor

7. Type Safety:
   - TypeScript provides autocomplete for column names
   - Compile-time checking of columnMapper keys

When to use Fluent API vs buildQueries():

- Use buildQueries() when:
  * You have a fixed set of parameters
  * You want a simple functional approach
  * Building from API request with known structure

- Use QueryBuilder when:
  * Conditions are truly dynamic (many optional filters)
  * You need to build queries in multiple steps
  * You prefer method chaining
  * You need to conditionally add clauses

Both produce the same output. Choose based on your use case and preference.
*/

module.exports = {
  buildEmployeeSearch,
  COLUMN_MAPPER,
  BASE,
};