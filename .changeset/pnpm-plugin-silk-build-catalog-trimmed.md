---
"@savvy-web/pnpm-plugin-silk": minor
---

## Breaking Changes

The silk `build` catalog is trimmed to `@tsdown/css` and `@types/bun`. Every other former member (`tsdown`, `rolldown`, `rolldown-plugin-dts`, `@microsoft/api-extractor`, `@microsoft/api-extractor-model`, `@microsoft/tsdoc`, `@microsoft/tsdoc-config`, `@tsdown/exe`, `@rsbuild/core`, `typescript`, `@types/node`, `tsx`, `react`, `react-dom`, `@types/react`, `@types/react-dom`) now comes from `@effected/pnpm-plugin-effected`'s `catalog:effected:build`.

To migrate, change each of those specifiers in your manifests from `catalog:build` to `catalog:effected:build`. Specifiers for `@tsdown/css` and `@types/bun` stay on `catalog:build`.

The managed `tsdown>rolldown-plugin-dts` override is removed along with the trimmed catalog.

### The docs and silk catalogs no longer serve toolchain packages

The `docs` and `silk` catalogs, and their `:peers` companions, no longer serve `typescript`, `tsx`, `@types/node`, `@types/react`, `@types/react-dom`, `react` or `react-dom`. Take them from `catalog:effected:build` (or `catalog:effected:build:peers` for peers). Installing silk without `@effected/pnpm-plugin-effected` is not supported.

`typescript`, `tsx`, `@types/node`, `@types/react` and `@types/react-dom` also left silk's `publicHoistPattern`. `@effected/pnpm-plugin-effected` hoists the same five, so they still reach your root.

## Maintenance

`minimumReleaseAgeExclude` no longer lists the packages `@effected/pnpm-plugin-effected` already excludes: `effect`, `@effect/*`, `@effected/*`, `@oxc-project/*`, `@rolldown/*` and `@typescript/*`.
