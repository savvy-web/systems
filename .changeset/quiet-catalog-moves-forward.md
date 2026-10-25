---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

### TypeScript 7 ships the Go compiler

* Removed `@typescript/native-preview` from the `silk` and `silk:peers` catalogs and from `publicHoistPattern`. TypeScript 7 includes the Go compiler in `typescript` itself, so consumers should drop any `catalog:silk` reference to `@typescript/native-preview`
* Removed the `@savvy-web/bundler>typescript: ^6.0.3` entry from `peerDependencyRules.allowedVersions`. The `@microsoft/api-extractor>typescript: ^6.0.3` override stays

## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :--- | :----- | :--- | :-- |
| @microsoft/api-extractor | config | updated | 7.59.1 | ^7.59.4 |
| @microsoft/api-extractor-model | config | updated | 7.33.12 | ^7.33.15 |
| @microsoft/tsdoc | config | updated | ~0.16.0 | ~0.17.1 |
| @microsoft/tsdoc-config | config | updated | 0.18.1 | ~0.18.3 |
| @typescript/native-preview | config | removed | ^7.0.0-dev.20260707.2 | — |

The `build` and `build:peers` catalogs move to the fixed tsdoc 0.17.1 line, undoing the earlier rollback now that microsoft/tsdoc#493 (dropped line break before an inline node) is resolved.
