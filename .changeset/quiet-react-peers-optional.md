---
"@savvy-web/silk": patch
---

## Bug Fixes

`react`, `react-dom`, `@types/react` and `@types/react-dom` are now optional peer dependencies. Only the `./tsconfig/rspress/website.json` preset uses them, so a repository without an RSPress docs site no longer gets a missing-peer report for packages it never needs. A repository that extends the RSPress preset keeps installing them as before.
