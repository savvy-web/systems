---
"@savvy-web/mcp": minor
---

## Features

The `changeset_deps_detect` and `changeset_deps_regen` tools each gain two new optional inputs, mirroring `@savvy-web/silk-effects`'s `DepsRegen` service:

* `packages` — an array of workspace package names to restrict the run to, unioned with the existing `package` input.
* `exclude` — an array of workspace package names to drop from scope entirely; nothing is written for them and their existing changesets are left untouched. Wins over `package` and `packages`.
