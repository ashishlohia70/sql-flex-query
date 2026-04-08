---
name: Bug Report
about: Report a bug or unexpected behavior
title: "[BUG] "
labels: bug
assignees: ''

---

## Description

A clear and concise description of what the bug is.

## Steps to Reproduce

1. How to trigger this bug
2. Code example that demonstrates the issue
3. Any specific configuration

Example:
```javascript
const { buildQueries } = require("sql-flex-query");

const BASE = `SELECT /*SELECT_COLUMNS*/ FROM users /*WHERE_CLAUSE*/`;

const result = buildQueries(
  BASE,
  [{ key: "status", operation: "IN", value: [] }], // Empty array causes error
  [],
  [],
  1,
  10,
  undefined,
  undefined,
  "postgres"
);
```

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened. Include error messages and stack traces.

```
Error message here
```

## Environment

- **Node.js version**: (e.g., 20.10.0)
- **sql-flex-query version**: (e.g., 1.1.0)
- **Database dialect**: (e.g., postgres, mysql, mssql, etc.)
- **Operating System**: (e.g., Windows 11, macOS 14, Ubuntu 22.04)
- **Package manager**: (e.g., npm 10.x, yarn 1.22.x, pnpm 8.x)

## Additional Context

Add any other context about the problem here:
- Does this happen with all dialects or just specific ones?
- Does it only happen with certain operations (IN, LIKE, NULL, etc.)?
- Have you tried different versions of sql-flex-query?
- Any relevant logs or screenshots?

## Minimal Reproduction

If possible, provide a link to a minimal reproduction repository or CodeSandbox/StackBlitz.

---

**Note**: Please don't delete any sections. The more information you provide, the faster we can help!