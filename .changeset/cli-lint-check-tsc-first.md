---
"@savvy-web/cli": patch
---

## Bug Fixes

* `savvy lint check` now probes `tsc` before `tsgo` when reporting TypeScript availability, matching the lint-staged handler's tsc-first compiler preference
