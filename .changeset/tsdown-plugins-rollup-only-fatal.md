---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Surface rollup-only CI-fatal forgotten-exports in local builds

Meta generation runs API Extractor twice: once over the bundled rollup `.d.ts` (the shipped model) and once over the per-module declaration tree (for accurate source locations). A CI-fatal `ae-forgotten-export` that exists ONLY in the bundled rollup — for example an external type inlined into the bundled declarations dragging in symbols the entry point does not export — was reported by neither run locally: the rollup run's diagnostics were discarded as having unreliable locations, and the per-module run never sees the issue because that package stays an external import there. The result was a build that looked clean locally but failed hard on CI.

The bundled-rollup run now captures its CI-fatal messages and, after the per-module run, surfaces the ones the per-module run did not also report — with the unreliable rollup location stripped — so a local build nudges (`[fails CI]`) instead of passing silently. Messages present in both runs are still reported once, with the per-module run's accurate location. Under CI the same rollup-only fatal escalates to a hard error that throws before the per-module run, so the bundled-rollup run now forwards its error-level diagnostics to the build report first — the failure names the offending symbol instead of an opaque "N error(s)". The shipped api-model and the CI gate itself are unchanged; this only adds reporting.
