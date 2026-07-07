---
"@savvy-web/mcp": minor
---

## Bug Fixes

* `biome_check` no longer silently upgrades project warn-level diagnostics to errors by default — severities now match the project's Biome config, the same as running `biome check` / `pnpm run lint` directly

## Features

* Added an optional `strict` input to `biome_check`. When `strict: true`, warnings are surfaced as errors in-process; each upgraded diagnostic is marked with `originalSeverity: "warning"`, and `summary.upgradedWarnings` reports how many were upgraded
* Guidance text is now severity-aware — a warnings-only run (no `strict`) returns non-blocking guidance instead of the previous fix-it-now wording
