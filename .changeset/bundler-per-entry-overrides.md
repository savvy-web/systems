---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### Per-entry format and bundling overrides

`defineBuild` gains an `overrides` option: an array of partitions that each pin a subset of export entries to their own output format and bundling posture, layered onto the base build. Use it to keep one entry CJS in an otherwise ESM-only package, or to inline a dependency for some entries while externalizing it for others. Each override declares its `entries` (export paths), plus any of `format`, `bundle`, `externals`, `bundleNodeModules`, `bundledPackages`, and `dtsExternals`. The base entries build first; each override partition builds after into the same output directory, and the emitted package.json gets per-entry export conditions so only the entries built with cjs receive a require condition.

`@savvy-web/silk` is the first consumer: it now builds ESM-only for every entry except changesets/markdownlint, which stays dual-format CJS because markdownlint-cli2 requires a CJS-loadable module.

New exports: `BuildEntryOverride` (from `@savvy-web/bundler`); `EntryOverride`, `DualExports`, and `createEntryName` (from `@savvy-web/tsdown-plugins`). The manifest transform's dual flag now also accepts a set of export keys for per-entry require conditions, and `buildTargetGroups` accepts `overrides` plus a `dualExports` set. Packages that do not use `overrides` build exactly as before.
