---
"@savvy-web/silk-effects": minor
---

## Bug Fixes

`Lint.PnpmWorkspace.formatContent` no longer post-processes its output through Prettier. It now stringifies directly via `@effected/yaml` with `quoteStyle: "double"` and `indentSequences: true`, producing the repo's byte format in one pass. This fixes a formatter regression where scoped package keys in `pnpm-workspace.yaml` were rewritten from double to single quotes (`"@parcel/watcher"` -> `'@parcel/watcher'`) on every `savvy lint fmt pnpm-workspace` run, causing churn on every format pass.

`formatContent` also dropped its now-unused `filepath` parameter, since there is no longer a second printer (Prettier) that needed it to resolve config.

* Fixed scoped-package-key quote-style churn in `pnpm-workspace.yaml` formatting
* `PnpmWorkspace.formatContent(content)` no longer takes a `filepath` argument

## Refactoring

* Replaced `sort-package-json` with `@effected/package-json`'s `PackageJsonFormat.sortValue`/`formatToString` (byte-identical output)
* `SilkPublishability` now reads `WorkspacePackage.workspaceRoot` from the discovered package instead of deriving it internally
* Changeset glob and version-file matching moved to `@effected/glob`'s `compileResult` and `@effected/walker`'s `compileAndExpand`, fixing a latent dot-glob dialect divergence between attribution and materialization (wildcard segments matching dotted directories now agree across both paths)
