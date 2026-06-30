---
"@savvy-web/silk": patch
"@savvy-web/cli": patch
"@savvy-web/mcp": patch
---

## Maintenance

Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so these packages pick up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds `LICENSE` files and applies minor manifest and `tsconfig.json` corrections across the three packages in the fixed release group, including moving `@savvy-web/silk-effects` to `devDependencies` in `@savvy-web/silk` (it is build-time only). No runtime behavior changes.
