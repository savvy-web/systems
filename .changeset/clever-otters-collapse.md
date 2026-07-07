---
"@savvy-web/silk-effects": minor
---

## Features

`DepsRegen` gains batch and exclude controls for regenerating dependency changesets across several packages in a single call:

* `DepsRegenOptions.packages` — restrict a run to a list of workspace packages, unioned with the existing single-package `package` option. Explicit targets bypass the versionable gate but not the ignore list.
* `DepsRegenOptions.exclude` — drop packages from scope entirely: nothing is written for them, and their existing pure-dependency changesets are left untouched. `exclude` wins over both `package` and `packages`.

```ts
import { Changesets } from "@savvy-web/silk-effects";

const plan = yield* Changesets.DepsRegen.plan({
	cwd: process.cwd(),
	packages: ["@scope/a", "@scope/b"],
	exclude: ["@scope/c"]
});
```

## Bug Fixes

* `computeWorkspaceDependencyDiffs` no longer reports a dependency reclassified between fields at an unchanged resolved version (e.g. moved from `devDependencies` to `dependencies` with no version bump) as an unrelated removed row plus an added row — the pair now collapses to nothing. A move that also changes the resolved version still produces both rows.
* `BranchAnalyzer.analyzeBranch` no longer reports the branch's own `.changeset/*.md` files in `files[]` / `unmappedFiles` — they are the artifact being reconciled, never a classification question.
