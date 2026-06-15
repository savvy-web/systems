---
"@savvy-web/github-action-builder": patch
---

## Bug Fixes

### Missing `@effect/*` peers no longer crash at load (#126)

`@savvy-web/github-action-builder` now declares `@effect/cluster`, `@effect/rpc`, and `@effect/sql` as direct dependencies (via `catalog:silk`). The `@effect/platform-node` root barrel eagerly links these clustering submodules, so without this declaration an install tree that did not already provide them would fail with `ERR_MODULE_NOT_FOUND` at startup.
