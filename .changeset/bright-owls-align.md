---
"@savvy-web/silk-effects": minor
---

## Features

- Export `CoexistingChangesetSchema`, `RegenPlanSchema`, and `RegenResultSchema` from `Changesets`, and derive the existing `CoexistingChangeset`, `RegenPlan`, and `RegenResult` types from those schemas so deps-regen result contracts are schema-first runtime surfaces.

## Refactoring

- Mark `withChangelogModules` and `extractVersionBlock` as `@internal` test-only helpers while preserving their in-module exports and runtime behavior.
