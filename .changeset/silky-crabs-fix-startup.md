---
"@savvy-web/cli": patch
---

## Bug Fixes

* Fixed a fresh-install crash on startup: `ERR_MODULE_NOT_FOUND` for `effect/process/ChildProcess` (or a sibling `effect` submodule) coming out of `@effect/platform-node`. The caret range `@effect/platform-node` carried on `@effect/platform-node-shared` could resolve a build of `-shared` that only ships modules present in a newer `effect` than the one actually installed alongside it. The suite now pins `effect` at `4.0.0-rc.118` throughout, matching the `@effect/platform-node-shared` build the `savvy` binary actually runs against, so `npx @savvy-web/cli` starts cleanly on a fresh install.
