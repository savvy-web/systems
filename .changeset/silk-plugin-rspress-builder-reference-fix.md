---
"@savvy-web/silk": patch
---

## Bug Fixes

Corrected the `plugins/silk` build skill's rspress-builder reference doc. The front-door example passed `apiModel`, an option `@savvy-web/rspress-builder` renamed to `meta`; the option table still listed the old `dtsBundledPackages`/`apiModel` names instead of the current `bundledPackages`/`dtsExternals`/`bundleNodeModules`/`meta` surface and the per-bundle `RspressBundleOptions` shape; and the peer contract named `@tsdown/css` as a consumer-supplied peer when it is rspress-builder's own dependency, while omitting the actual `typescript` peer. The doc also gained a section on the package's `./env` ambient-types export. Agents read this file when scaffolding or building an RSPress plugin, so the stale names and contract were being copied into new work.
