---
"@savvy-web/pnpm-plugin-silk": minor
---

## Breaking Changes

The silk `build` catalog is trimmed to `@tsdown/css` and `@types/bun`. Every other former member (`tsdown`, `rolldown`, `rolldown-plugin-dts`, `@microsoft/api-extractor`, `@microsoft/api-extractor-model`, `@microsoft/tsdoc`, `@microsoft/tsdoc-config`, `@tsdown/exe`, `@rsbuild/core`, `typescript`, `@types/node`, `tsx`, `react`, `react-dom`, `@types/react`, `@types/react-dom`) now comes from `@effected/pnpm-plugin-effected`'s `catalog:effected:build`.

To migrate, change each of those specifiers in your manifests from `catalog:build` to `catalog:effected:build`. Specifiers for `@tsdown/css` and `@types/bun` stay on `catalog:build`.

The managed `tsdown>rolldown-plugin-dts` override is removed along with the trimmed catalog.
