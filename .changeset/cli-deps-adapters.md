---
"@savvy-web/cli": patch
---

## Bug Fixes

`savvy changeset deps regen`/`deps detect` now route through silk-effects' `Changesets.DepsRegen`, so regenerated dependency changesets resolve `catalog:`/`workspace:` specifiers to concrete versions (#199) and omit `devDependency` rows that never reach a consumer (#151). The emitted `## Dependencies` tables are now CSH005-valid and pass pre-commit, instead of passing the CLI checks but failing at commit time.
