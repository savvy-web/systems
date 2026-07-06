---
"@savvy-web/bundler": patch
---

## Bug Fixes

- Fixed `bundleNodeModules: true` builds (via the underlying `@savvy-web/tsdown-plugins` engine) producing a non-self-contained ESM output — inlined `node_modules` dependencies were written to sibling chunk files that `npm pack` strips from the published tarball, breaking the ESM entry with `Cannot find module` post-install. Both ESM and CJS outputs now bundle into a single self-contained file per format.
