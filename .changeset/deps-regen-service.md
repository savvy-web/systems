---
"@savvy-web/silk-effects": minor
---

## Features

Added `Changesets.DepsRegen`, a `plan()`/`execute()` service that owns dependency-changeset regeneration. `plan()` computes the cumulative dependency diff and returns a complete, side-effect-free plan; `execute()` applies it. Along the way it resolves `catalog:`/`workspace:` specifiers to concrete versions (falling back to the raw specifier when a catalog cannot be resolved, so a commit is never blocked) and drops `devDependency` rows, which never reach a consumer.

`ChangesetLinter` now enforces the dependency-table format: `validateContent` runs the remark `DependencyTableFormatRule`, so `savvy changeset check`/`lint` and the `changeset_validate` MCP tool reject a prose `## Dependencies` section — the same check the pre-commit markdownlint CSH005 rule already ran. The dependency-table version pattern is now a single exported `VERSION_RE`, widened to accept `catalog:`/`workspace:`/`npm:` protocol specifiers.

Closes the changeset validator split-brain behind #193, #199, and #151.
