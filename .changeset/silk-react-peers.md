---
"@savvy-web/silk": major
---

## Breaking Changes

### Toolchain and React packages are now peer dependencies

`@savvy-web/silk` now declares `typescript`, `tsx`, `@types/node`, `@types/react`, `@types/react-dom`, `react` and `react-dom` as peer dependencies, with ranges from the effected build peers catalog. `react`, `react-dom`, `@types/react` and `@types/react-dom` are new required peers, so projects that do not already install them must add them.

## Features

`@savvy-web/silk` now ships `@effected/changesets` and `@effected/github` as dependencies, so the changeset commands run on the effected engine.
