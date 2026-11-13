---
"@savvy-web/silk-effects": major
---

## Breaking Changes

- `@effected/npm` is now a required peer dependency. `@effected/changesets` 0.6.0 requires it, and silk-effects takes `@effected/changesets` as a peer, so install `@effected/npm` next to it.
- `Lint.PackageManager` no longer includes `"yarn"`, and `Command.getExecPrefix` no longer accepts it. The `@effected` kit dropped yarn as a package manager it runs tools through. In a yarn repository, `Command.detectPackageManager` now returns `"npm"`, so the lint-staged handlers look for their tools through `npx --no --`. The commit hooks are unaffected: `Commitlint.detectPackageManager` still reports `"yarn"` for a yarn repository.
