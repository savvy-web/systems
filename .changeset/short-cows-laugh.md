---
"@savvy-web/mcp": patch
---

## Bug Fixes

- Validate `changeset_deps_detect` dependency rows with `Changesets.RegenDiffRowSchema` so valid unresolved raw specifiers from `DepsRegen.plan()` (`*`, `^1.2`, etc.) are accepted.
