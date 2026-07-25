---
"@savvy-web/bundler": patch
---

## Bug Fixes

* `runBuild` (and the bundler's own `savvy.build.ts` self-build) now passes the caught build error into the issues-artifact writer, stamping `buildOk: false` (plus a `failure` description) when a build crashes, instead of leaving the artifact looking like a clean pass.
