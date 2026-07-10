---
"@savvy-web/silk-effects": minor
---

## Features

### Refuse to publish a directory the prod `targets.json` binding does not describe

`SilkPublishability.resolveTargets` now asserts that every surviving target's directory is one of the group directories named by the package's `dist/prod/targets.json`, whenever that binding exists. A directory outside it means publishability detection did not select the prod build output.

This is the `yaml-effect@0.7.1` shape from #143: silk mode was misdetected, detection fell through to the vanilla `publishConfig.directory` branch and picked `dist/dev/pkg`, and the dev manifest — still carrying `catalog:` specifiers — was packed and published. The published package could not be installed anywhere (`EUNSUPPORTEDPROTOCOL: Unsupported URL Type "catalog:"`).

- New `PublishTargetBindingError` (exported) carries the package, the directory detection chose, and the directories the binding actually binds.
- `resolveTargets` gains that error in its error channel; it was previously `never`. Callers must handle or propagate it.
- Before the prod build writes a binding there is nothing to check, so pre-build placeholder directories are left alone.

Refs #143, #144.
