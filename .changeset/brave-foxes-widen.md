---
"@savvy-web/mcp": minor
---

## Features

* `changeset_deps_regen`/`changeset_deps_detect` now report catalog-aware dependency rows: a stable `catalog:` specifier whose resolved version changed shows the concrete `from`/`to` versions, and a package that only adopted a `catalog:` specifier without a version change no longer produces a row.
* Dependency-changeset gating now follows the `publishable OR privatePackages.version` (minus ignored) rule, matching the rest of the changeset tooling.

## Refactoring

* Both tools' declared error unions widen to include `ChangesetIOError` and `PointInTimeReadError`, reflecting the underlying `DepsRegen` service's new failure modes. Internal layer composition moved from `WorkspaceSnapshotReaderLive` to `workspaces-effect`'s `PointInTimeWorkspaceLive`.
