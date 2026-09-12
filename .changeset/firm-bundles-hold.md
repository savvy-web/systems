---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

* A per-override `bundle` list is now forwarded as `alwaysBundle` into the dts pass and the prod-only declarations pass, matching the JS pass. The dts pass re-emits the dual-format `.cjs` chunk, so a force-bundled declared dependency was being re-externalized there; it now stays inlined in every emitted format.
