---
"@savvy-web/tsdown-plugins": minor
---

## Features

* `buildMetricsPlugin` takes a new optional `suppressMixedExports` argument. When set, rolldown's `MIXED_EXPORTS` warning is routed to the build report's suppressed bucket — labelled `MIXED_EXPORTS` — instead of printing to the console. The builder enables it automatically for every pass that installs `cjsDefaultInterop()`, where the warning's premise no longer holds: the interop footer already makes `require(x)` and `import(x).default` resolve to the same thing.

## Bug Fixes

* Removes the last uses of tsdown's deprecated `deps.skipNodeModulesBundle`, which printed `` `deps.skipNodeModulesBundle` is deprecated. Use `deps.neverBundle: true` instead. `` on every build of a `bundleNodeModules` package. `bundleNodeModules` now relies entirely on the JS pass's default bundling behavior, and the dts pass's selective-inlining branch (`bundledPackages` without `bundleNodeModules`) moves to `deps.neverBundle: true`. Output is unaffected — the warning simply stops.
