---
"@savvy-web/cli": patch
"@savvy-web/mcp": patch
---

## Bug Fixes

* Fresh installs no longer crash on startup with `ERR_MODULE_NOT_FOUND` for `effect/dist/process/ChildProcess.js`. `@effect/platform-node` declares `@effect/platform-node-shared` with a caret range, so once `4.0.0-rc.118` was published, installs without a lockfile paired it with the exactly-pinned `effect@4.0.0-rc.117`. The rc.118 package imports a module that rc.117 does not ship. `@effect/platform-node-shared` is now pinned to the same version as `effect` and `@effect/platform-node`.
