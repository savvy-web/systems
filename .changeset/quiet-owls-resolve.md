---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

* API Extractor's diagnostics-only pass now resolves a package's own name (a self-reference such as `import type * as Root from "@scope/pkg"` in a sub-entry) to the built per-module declarations instead of raw `src/*.ts`. This removes a spurious, unsuppressable `ae-wrong-input-file-type` and the "Could not harvest per-module source locations" crash.
* Entries that previously crashed now report their real `ae-*` and `tsdoc-*` diagnostics in `issues.json`.
* A remaining harvest failure now carries the code `diagnostics-harvest-failed` instead of `null`.
