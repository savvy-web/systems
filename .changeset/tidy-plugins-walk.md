---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

* Build report environment detection no longer uses `std-env` (the dependency is dropped); `CI=false` now reads as not CI.
* A symlinked directory inside `public/` is now skipped instead of failing the copy. Built output is otherwise unchanged.
