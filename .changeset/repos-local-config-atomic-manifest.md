---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

`ReposDrift.check` now reads submodule registrations from the repository's local git config rather than the merged view, so a `submodule.*` section that only global or system config carries is no longer reported as a stale local registration. `deregister` could never clear those sections, because it removes local ones only.

## Refactoring

`ReposManager.deregister` reads the local config with `configList`'s `scope` option, replacing its own lookup of a linked worktree's config file. `ReposConfigStore.write` replaces the manifest with `AtomicFile.write` from the new `@effected/files` dependency, so a failed write leaves no temp file behind and the write now reaches disk before the rename. If the manifest is a symlink, the write now lands on the link's target and the link stays, where it used to replace the link.
