# Contributing to sql-flex-query

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

---

## Ways to Contribute

- **🐛 Bug reports**: Found a bug? [Open an issue](https://github.com/ashishlohia70/sql-flex-query/issues).
- **💡 Feature requests**: Have an idea? [Start a discussion](https://github.com/ashishlohia70/sql-flex-query/discussions).
- **🔧 Code contributions**: Submit a pull request.
- **📚 Documentation**: Improve examples, fix typos, add tutorials.
- **✅ Testing**: Add test cases, especially for edge cases or new dialects.
- **🌍 Translations**: Help translate documentation.

---

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/ashishlohia70/sql-flex-query.git
cd sql-flex-query
npm install
```

### 2. Development Workflow

- **Branch**: Create a branch for your changes
  ```bash
  git checkout -b feature/my-feature
  # or
  git checkout -b fix/my-bugfix
  ```

- **Code**: Make your changes. Follow the existing code style.

- **Test**: Ensure all tests pass and add new tests for your changes
  ```bash
  npm test
  ```

- **Build**: Ensure the library builds successfully
  ```bash
  npm run build
  ```

- **Commit**: Use clear, descriptive commit messages
  ```bash
  git add .
  git commit -m "feat: add support for XYZ dialect"
  # or
  git commit -m "fix: handle NULL values in WHERE clause"
  ```

- **Push**: Push to your fork
  ```bash
  git push origin feature/my-feature
  ```

- **PR**: Open a Pull Request against the `main` branch. See PR template below.

---

## Code Style

- Use **TypeScript** (obviously 😄)
- Follow existing patterns (functional style for `buildQueries`, class-based for `QueryBuilder`)
- Use meaningful variable/function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Prefer `const` over `let`
- Use semicolons (the codebase uses them)

---

## Testing

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
```

### Adding Tests

- Place tests in the `tests/` directory
- Name files as `filename.test.ts`
- Test both the generated SQL and the parameters
- Test edge cases (empty arrays, null values, special characters)
- Test all supported dialects for dialect-specific features

Example:

```typescript
import { describe, it, expect } from "vitest";
import { buildQueries } from "../src/index";

describe("buildQueries", () => {
  it("generates correct PostgreSQL syntax for EQ operation", () => {
    const BASE = `SELECT /*SELECT_COLUMNS*/ FROM users /*WHERE_CLAUSE*/`;

    const result = buildQueries(
      BASE,
      [{ key: "status", operation: "EQ", value: "ACTIVE" }],
      [],
      [],
      1,
      10,
      undefined,
      undefined,
      "postgres"
    );

    expect(result.searchQuery).toContain('"status" = $1');
    expect(result.params).toEqual(["ACTIVE"]);
  });

  it("generates correct MySQL syntax for EQ operation", () => {
    const BASE = `SELECT /*SELECT_COLUMNS*/ FROM users /*WHERE_CLAUSE*/`;

    const result = buildQueries(
      BASE,
      [{ key: "status", operation: "EQ", value: "ACTIVE" }],
      [],
      [],
      1,
      10,
      undefined,
      undefined,
      "mysql"
    );

    expect(result.searchQuery).toContain('`status` = ?');
    expect(result.params).toEqual(["ACTIVE"]);
  });
});
```

---

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass locally (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] New features include tests
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (feat:, fix:, docs:, etc.)

### PR Description

Include:
- What changed and why
- Screenshots/output (if applicable)
- Breaking changes (if any)
- Linked issues

### Review Process

- I'll review your PR within a few days
- May request changes or clarification
- Once approved, it will be merged into `main`
- A new release will be published (if applicable)

---

## Adding Support for a New Dialect

If you want to add support for a new SQL dialect:

1. Create a new file in `src/dialects/` (e.g., `mydialect.dialect.ts`)
2. Implement the `Dialect` interface from `src/dialects/base.dialect.ts`
3. Add the dialect to `src/dialects/index.ts`
4. Add tests in `tests/mydialect.test.ts`
5. Update the supported databases table in README.md
6. Add dialect-specific test cases

---

## Reporting Bugs

When reporting bugs, please include:

- **Description**: Clear, concise description of the bug
- **Steps to reproduce**: How to reproduce the issue
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Environment**:
  - Node.js version
  - sql-flex-query version
  - Database dialect (postgres, mysql, etc.)
  - OS (if relevant)
- **Code snippet**: Minimal code that reproduces the bug
- **Error output**: Full error message and stack trace

Example:

```
## Bug Report

**Description**: buildQueries generates invalid SQL for IN operation with empty array

**Steps to Reproduce**:
1. Call buildQueries with whereParams containing { key: 'status', operation: 'IN', value: [] }
2. Observe generated SQL

**Expected**: Should handle empty array gracefully (maybe skip the condition or generate `IN (NULL)`)

**Actual**: Throws "Cannot read property 'length' of undefined"

**Environment**:
- Node.js: 20.x
- sql-flex-query: 1.1.0
- Dialect: postgres

**Code**:
```javascript
const result = buildQueries(BASE, [{ key: 'status', operation: 'IN', value: [] }], ...);
```

**Error**:
TypeError: Cannot read property 'length' of undefined
    at buildWhereClause (src/builder/build-queries.ts:123:45)
```

---

## Feature Requests

Before submitting a feature request:

1. **Search existing issues** to avoid duplicates
2. **Consider if it fits the library's scope**: sql-flex-query is a SQL query builder, not a full ORM
3. **Provide a clear use case**: Why is this feature needed? Who benefits?
4. **Suggest an API design**: How would you use this feature?

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Questions?

- **General questions**: Use [GitHub Discussions](https://github.com/ashishlohia70/sql-flex-query/discussions)
- **Specific questions**: Comment on relevant issues or PRs
- **Private**: Reach out to [@ashishlohia70](https://github.com/ashishlohia70) on GitHub

---

Thank you for contributing! 🎉