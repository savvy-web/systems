---
"@savvy-web/silk-effects": patch
---

## Documentation

Documents the `Changesets` namespace services in the README, which previously appeared only as a single line in the feature list:

* `ChangesetLinter` — static, synchronous validation of a changeset file against the Silk section rules
* `ConfigInspector` — resolves `.changeset/config.json` into an attributed view of the workspace, and maps arbitrary file paths to the package that owns them
* `ReleasePlanner` — `plan`, `preview` and `apply` over the genuine changesets engine, including the `changelogModules` option for callers running without `node_modules`
* `BranchAnalyzer` — classifies a branch diff by owning package
* `DepsRegen` — the `plan`/`execute` split behind dependency changesets, with the batteries-included `DepsRegenDefault` layer

Each entry states its real layer requirements, verified against the source rather than carried over from prose.
