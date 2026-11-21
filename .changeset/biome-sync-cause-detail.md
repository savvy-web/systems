---
"@savvy-web/cli": patch
---

## Bug Fixes

`savvy lint init` and `savvy init` show why a Biome config could not be synced again: the JSONC parse error or the filesystem failure is printed as a detail line under the "Could not sync biome $schema" warning.
