---
"@savvy-web/pnpm-plugin-silk": minor
---

## Breaking Changes

The `silk` and `silk:peers` catalogs no longer carry `ink`. `@effected/pnpm-plugin-effected` 0.26.2 and later serves it in `effected:build` and `effected:build:peers`, beside React, because it is the renderer `@effected/cli-kit` draws with. A manifest that still writes `"ink": "catalog:silk"` now fails to install with `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC`: rewrite it to `"ink": "catalog:effected:build"`, or `"ink": "catalog:effected:build:peers"` for a peer, keeping the entry in the field it was in. The `silk` catalogs now hold only `@types/bun`.
