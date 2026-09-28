---
"@savvy-web/silk": patch
---

## Bug Fixes

* Fixed a fresh-install crash on startup for the `savvy` and `savvy-mcp` binaries silk carries: `ERR_MODULE_NOT_FOUND` for `effect/process/ChildProcess` (or a sibling `effect` submodule) coming out of `@effect/platform-node`. The suite now pins `effect` at `4.0.0-rc.118` throughout, matching the `@effect/platform-node-shared` build the underlying `@savvy-web/cli` and `@savvy-web/mcp` binaries actually run against, so installing `@savvy-web/silk` alone starts both bins cleanly.
