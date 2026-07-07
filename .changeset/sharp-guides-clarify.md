---
"@savvy-web/silk": patch
---

## Documentation

* The `changeset-manager` agent gains a sixth exclusion category, cross-package documentation drift, and a new rule requiring code examples in changesets to match the real API surface. The `config` skill's exclusion-category list is updated to match (five categories → six).
* The `tsdoc` skill's `ae-forgotten-export` guidance now distinguishes an in-package unexported type from an externally-inlined dependency type — each needs a different fix. The `ae-missing-release-tag` guidance now documents the `export * as NS` / `_d_exports` limitation and its sanctioned `suppressWarnings` workaround.
