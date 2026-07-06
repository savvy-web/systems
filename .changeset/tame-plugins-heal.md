---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

* Sealed the toolchain's Effect peer-dependency graph by declaring the full required-peer closure as regular dependencies: `effect` (previously peer-only), `@effect/platform`, `@effect/rpc`, `@effect/sql`, `@effect/cluster`, `@effect/experimental`, and `@effect/workflow` (all previously undeclared, reachable only as auto-installed peers of `@effect/platform-node`, `@effect/sql`, and `@effect/cluster`). In a consumer workspace with `autoInstallPeers`, pnpm installed the missing peers at the consumer's importer level, so a consumer depending on a different major of `effect` could poison peer resolution — binding `@effect/platform` against an incompatible `effect` version and crashing `savvy.build.ts` with `ERR_MODULE_NOT_FOUND` on `effect/Either`. Every peer in the closure now resolves from the toolchain's own `effect` v3 context regardless of the consumer's `effect` version (#228)
