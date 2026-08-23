---
"@savvy-web/silk": patch
---

## Bug Fixes

### Declare the peers silk-effects requires

`@savvy-web/silk` externalizes `@savvy-web/silk-effects` and re-adds it to its published manifest as a runtime
dependency, so installing silk resolves silk-effects transitively — and inherits the three peers silk-effects now
requires. Nothing in the published graph named them.

Under pnpm's `autoInstallPeers: true` that silently materialized a second copy of each, which is the duplication
the peer change exists to remove. Under yarn, or pnpm with `autoInstallPeers: false`, `import "@savvy-web/silk/lint"`
failed with `ERR_MODULE_NOT_FOUND`.

`@effected/commands`, `@effected/git` and `@effected/workspaces` are now declared, so a consumer installing silk
alone gets a coherent graph.
