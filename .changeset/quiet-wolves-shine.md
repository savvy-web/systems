---
"@savvy-web/silk-effects": minor
---

## Features

- Added `SilkWorkspaceAnalyzer` service — composite service that analyzes a workspace root and produces a complete `WorkspaceAnalysis` result. Discovers workspaces via `workspaces-effect`, detects publishability with Silk multi-target support, reads changeset config, computes versioning strategy, and determines release status per workspace.
- Added `AnalyzedWorkspace` and `WorkspaceAnalysis` — `Schema.TaggedClass` data types with instance methods for workspace queries, target lookups, group membership, and filtered views. Includes `Equal`/`Hash` support and `Pretty` printing.
- Added `SilkPublishConfig` schema — extends the upstream `PublishConfig` from `workspaces-effect` with a Silk `targets` field for multi-registry publishing.
- Extended `ChangesetConfig` to cover the full `@changesets/config@3.1.1` specification, including `privatePackages`, `snapshot`, `prettier`, `changedFilePatterns`, and `bumpVersionsWithWorkspaceProtocolOnly`.

## Tests

- Added 100+ fixture files across standalone, pnpm, npm, yarn, and bun workspace configurations, with 29 integration tests that exercise the full `SilkWorkspaceAnalyzer` pipeline against real filesystem reads.
- `AnalyzedWorkspace` and `WorkspaceAnalysis` include property-based test coverage via `fast-check`.

## Maintenance

- Migrated all co-located unit tests from `src/` to `__test__/` for consistent `vitest` auto-discovery.
