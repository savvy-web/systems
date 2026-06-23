---
"@savvy-web/silk": patch
---

## Documentation

### `/silk:tsdoc` and `tsdoctor` — sharper authoring guidance

Three clarifications to the `silk:tsdoc` skill and the `tsdoctor` agent, from a large real-world sweep:

- `@packageDocumentation` belongs only in entry-point files — one per `exports` entry, not one per package (a multi-entry package tags each entry module) — never on a non-entry leaf file.
- Every export carrying `@public` or `@internal` needs a one-line summary, not just the release tag. A bare tag that clears `ae-missing-release-tag` but leaves the block empty is only half the fix.
- Barrel files that re-export values or types are flagged as a documentation footgun. Refactoring the export structure is outside the agent's mechanical loop, so the agent now flags a barrel re-export and asks before changing it rather than reshaping exports unilaterally.

### `/silk:tsdoc` — locate diagnostics by symbol name

The `silk:tsdoc` skill now tells you to find an `ae-*` / `tsdoc-*` diagnostic's declaration by the symbol name quoted in the entry's `text`, not by `file`/`line`. Those location fields are no longer emitted for API Extractor diagnostics because the bundled-`.d.ts` analysis reported them against the wrong file. This matches the paired change in `@savvy-web/tsdown-plugins` that drops the misleading location.
