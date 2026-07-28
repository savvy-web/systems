---
"@savvy-web/tsdown-plugins": minor
---

## Bug Fixes

The meta tsconfig shipped at dist/prod/npm/meta/tsconfig.json now carries the resolved `types` array. The kit's PortableTsconfig allow-list classifies `types` as path-dependent and drops it, but it holds `@types/*` package names, not filesystem paths, and it is the only signal telling a downstream virtual TypeScript environment which ambient type packages to load. Without it, consumers building virtual environments got no `@types/node`, so `console`, `process` and `Buffer` were all missing. `types` is now merged back in from the resolved compiler options whenever the source config declares it; `typeRoots` stays dropped since those are genuinely absolute, machine-specific paths.
