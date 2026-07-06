---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

- Fixed `bundleNodeModules: true` builds emitting a per-module (`preserveModules`) ESM output whose inlined `node_modules` dependencies lived in sibling chunk files nested under `node_modules/...` paths. `npm pack` strips any directory literally named `node_modules` from the published tarball, so the packed ESM entry threw `Cannot find module` once installed. `unbundle` now turns off automatically whenever `bundleNodeModules` is set (including per-entry overrides), producing a single self-contained file per format.
- Silenced rolldown's `PLUGIN_TIMINGS` plugin-performance diagnostic in normal builds — the builder's own always-on plugins tripped it on virtually every run, making it unactionable noise. Verbose mode keeps the timings available for profiling sessions.
