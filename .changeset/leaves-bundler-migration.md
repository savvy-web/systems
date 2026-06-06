---
"@savvy-web/templates": patch
"@savvy-web/github-action-effects": patch
"@savvy-web/silk-effects": patch
"@savvy-web/github-action-builder": patch
---

## Other

Build via `@savvy-web/bundler` instead of `@savvy-web/rslib-builder`. The public API of each package is unchanged; published TypeScript declarations are now bundled into a single self-contained file per entry. `@savvy-web/github-action-builder`'s bundled `tsconfig/action.json` asset moved internally, but the consumer export subpath `@savvy-web/github-action-builder/tsconfig/action.json` is unchanged.
