---
"@savvy-web/silk-effects": minor
---

## Breaking Changes

`TurboInspector` now defaults its task to `build` instead of `build:dev`. Callers that relied on the default to inspect the dev build must pass `build:dev` explicitly.

## Bug Fixes

`Command.findSavvyLint`'s dogfood fallback now runs `packages/cli/src/bin.ts`.
