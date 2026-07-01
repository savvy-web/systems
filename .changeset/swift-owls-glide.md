---
"@savvy-web/tsdown-plugins": patch
---

## Performance

`buildEmittedManifest` now skips the `resolveManifest(pkg)` call — a full `workspaces-effect` `CatalogResolver` plus pnpm-workspace and lockfile assembly — when the manifest has no `catalog:`/`workspace:` specifiers in any dependency field. A new `manifestNeedsCatalogResolution` guard gates the call.

* Behavior-preserving: `resolveManifest` already returned such manifests unchanged, so this is a pure speedup on every prod build of a catalog-free package
* Removes host-workspace coupling from in-process unit tests

See #196.
