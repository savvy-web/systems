---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### Deterministic, self-contained per-entry declarations

The declaration pass now emits one self-contained `.d.ts` per public entry instead of rolling every entry through a single multi-entry pass. A multi-entry package no longer produces a cross-entry, content-hashed shared declaration chunk, so its declaration output is stable across clean rebuilds.

* A secondary entry that is a pure named re-export of a subset of the primary `index` entry is emitted as a thin `export { … } from "./index.js"` stub instead of re-inlining the shared surface, so re-export-heavy multi-entry packages stay compact.
* The declaration-emit TypeScript pass runs with `stableTypeOrdering`, so union and type members serialize in a stable order across builds. It is scoped to the emit pass only, so the bundled API Extractor (which predates the flag) is unaffected.

## Bug Fixes

* Declaration (`.d.ts`) and API-model (`.api.json`) output is now byte-reproducible across repeated clean builds of multi-entry packages. Previously the shared declaration chunk's name and layout, plus TypeScript union-member ordering, varied between otherwise-identical builds.
