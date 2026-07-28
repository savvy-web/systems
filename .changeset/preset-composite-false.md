---
"@savvy-web/bundler": patch
"@savvy-web/rspress-builder": patch
---

## Bug Fixes

The published tsconfig presets (bundler's ecma.json, and rspress-builder's ecma.json and plugin.json) now set `composite: false` instead of `composite: true`. Nothing in this repo uses project references, and both tsconfigs the suite emits already force `composite: false` independently, so this changes no emitted build artifact. It only removes the console warnings consumer `tsc` runs produce when a non-referenced project inherits `composite: true`.
