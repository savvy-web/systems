---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

`@microsoft/api-extractor`, `@microsoft/tsdoc`, and `@microsoft/tsdoc-config` now resolve from `catalog:build` instead of pinning their own version ranges directly, keeping them in lockstep with the rest of the suite's build tooling.
