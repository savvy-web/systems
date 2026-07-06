---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

- `ChangesetConfigReader` now recognizes the standalone `@savvy-web/changelog` package as a Silk changelog adapter. Configs written by the new `savvy init` (which uses `@savvy-web/changelog` as the canonical `changelog` id) were silently decoded as plain non-Silk configs because the id matched neither legacy marker substring. The two legacy id families (`@savvy-web/changesets` and `@savvy-web/silk/changesets`) remain accepted.
