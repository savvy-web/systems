---
"@savvy-web/cli": patch
---

## Bug Fixes

`savvy init` now syncs the biome `$schema` URL in every workspace package, not just the workspace root. A monorepo where a leaf package carries its own `biome.json` or `biome.jsonc` previously left those files pinned to whatever Biome version they were written against, while the root config was updated.

* Workspace package roots are enumerated with `@effected/workspaces`, and each one carrying a biome config is synced in the same pass
* A repo with no workspace root (a plain single-package project) is unaffected: the current directory is still scanned exactly as before
* A config that cannot be read or parsed is now reported and skipped rather than aborting the remaining packages
