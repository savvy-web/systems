---
"@savvy-web/cli": minor
---

## Features

* `savvy changeset deps regen`/`deps detect` now report catalog-aware dependency rows: a stable `catalog:` specifier whose resolved version changed shows the concrete `from`/`to` versions, and a package that only adopted a `catalog:` specifier without a version change no longer produces noise.
* Dependency-changeset gating now follows the `publishable OR privatePackages.version` (minus ignored) rule, matching the rest of the changeset tooling.
* Both commands now also handle `GitReadError` alongside `GitError`, so snapshot-read failures exit with a clear error instead of an unhandled rejection.

## Refactoring

* Internal layer composition for `deps regen`/`deps detect` moved from `CatalogResolverLive`/`WorkspaceSnapshotReaderLive` to `workspaces-effect`'s `PointInTimeWorkspaceLive`.
