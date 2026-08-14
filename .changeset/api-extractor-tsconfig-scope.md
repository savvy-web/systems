---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

Scopes the API Extractor pass to its own derived tsconfig instead of reusing the compile tsconfig verbatim. The compile config's `src/**` include could pull raw TypeScript sources into the extractor's analysis Program — a hand-authored `src/*.d.ts` shim with a self-name import resolved through the source manifest's `exports` — producing an unsuppressable `ae-wrong-input-file-type` warning in `issues.json` on every build.

* Each extractor run now receives a temp tsconfig that extends the resolved compile config by absolute path but limits inputs to the entry `.d.ts` (`files`) plus `types/*.d.ts` legacy typings
* Packages that carry ambient declaration shims under `src/` can now reach a zero-warning `issues.json`
