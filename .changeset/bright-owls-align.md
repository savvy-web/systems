---
"@savvy-web/silk-effects": minor
---

## Features

- Export `CoexistingChangesetSchema`, `RegenDiffRowSchema`, `RegenPlanSchema`, and `RegenResultSchema` from `Changesets`, and derive the existing `CoexistingChangeset`, `RegenDiffRow`, `RegenPlan`, and `RegenResult` types from those schemas so deps-regen result contracts are schema-first runtime surfaces.
- Align `RegenPlanSchema` with `DepsRegen.plan()` output by accepting unresolved raw dependency specifier cells (`*`, `^1.2`, `latest`, etc.) in in-memory regen diff rows.

## Refactoring

- Mark `withChangelogModules` and `extractVersionBlock` as `@internal` test-only helpers while preserving their in-module exports and runtime behavior.
