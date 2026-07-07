---
"@savvy-web/silk": patch
---

## Bug Fixes

* The published manifest no longer promotes `@savvy-web/changelog`, `@savvy-web/cli`, and `@savvy-web/mcp` from `dependencies` to `peerDependencies`. Promoting them to peers let pnpm's `autoInstallPeers` propagate their Effect dependency graph into consuming repos at versions `@savvy-web/silk` didn't control. They now ship as regular, exact-pinned `dependencies` instead — the exact-version coupling via `workspace:*` is unchanged, only the manifest field. `@savvy-web/pnpm-plugin-silk` already hoists all three publicly, so their bins remain available to consumers either way.
