---
"@savvy-web/silk": patch
---

## Bug Fixes

### Ship ESM-only for every entry except changesets/markdownlint

silk now builds ESM-only and externalizes the silk-effects dependency for all entries except changesets/markdownlint, which stays dual-format CJS because markdownlint-cli2 requires a CJS-loadable module and inlines silk-effects for that one entry. This drops silk's published size substantially while preserving the markdownlint custom-rules contract. silk-effects is now published as a runtime dependency so consumers can resolve the externalized imports.
