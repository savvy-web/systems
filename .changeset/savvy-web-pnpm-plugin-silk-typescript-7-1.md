---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

- The `build`, `docs` and `silk` catalogs, and their `:peers` companions, now declare TypeScript `^7.1.0-beta` explicitly, locked rather than minor-locked. Consumers resolve the same 7.1 compiler the Silk build toolchain emits declarations with, instead of picking up the beta implicitly through `@savvy-web/silk`'s peer auto-install.

## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| typescript | config | updated | ^7.0.2 | ^7.1.0-beta |
