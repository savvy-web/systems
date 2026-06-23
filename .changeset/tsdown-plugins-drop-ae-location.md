---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

### Drop the misleading source location from API Extractor diagnostics

API Extractor diagnostics (`ae-*` / `tsdoc-*`) in the build report and `dist/<target>/issues.json` no longer carry `file`, `line`, or `column`. The pass analyzes the bundled `.d.ts` and maps positions back through its source map, which anchored every message to the start of an adjacent declaration rather than the symbol it described — so the reported location pointed at the wrong file. A misleading location is worse than none; the authoritative locator is the symbol name quoted in the diagnostic `text`. Diagnostics from tsdown and rolldown keep their reliable locations.

Because location no longer distinguishes entries, two diagnostics with identical `code` and `text` now coalesce into one artifact entry (most visible for `ae-unresolved-link`, whose `text` names the link target rather than the bearing declaration). This only affects the per-site count for same-text diagnostics; grepping the quoted name still surfaces every site.
