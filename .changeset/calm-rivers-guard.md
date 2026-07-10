---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

- Replaced the unanchored trailing-slash regex in the workspace analysis `sameRegistry` comparison with a shared index-scan helper (`trimTrailingSlashes`), eliminating a polynomial-time regex (CodeQL `js/polynomial-redos`) that degraded to O(n²) on registry strings containing long interior slash runs. `normalizeDir` in the publishability service now uses the same helper.
