---
"@savvy-web/silk-effects": minor
---

## Breaking Changes

`ReposLockdown` now locks the vendored **worktree only**. The submodule's git metadata directory is no longer chmodded read-only.

Locking the metadata directory made the vendored boundary enforce itself solely through an `EACCES` that named neither the directory nor a reason, and it broke ordinary git tooling. A plain `git pull` that moves a gitlink recurses by default and dies writing `FETCH_HEAD`, and any client that keeps per-gitdir state cannot function at all — GitKraken writes a `gk/` directory into every gitdir it manages, which no git setting governs.

The worktree lock still blocks edits to vendored files and still blocks `git reset --hard`. It does not block `git checkout <other>` inside a vendored tree, verified against git 2.54, so the invariant weakens from "the pin cannot drift" to "a drifted pin is always detected and one command from repaired": git reports the submodule as out of sync, `ReposDrift` reports `checkoutDiverged`, and `restore` repairs it.

`unlock` still walks the metadata directory even though `lock` no longer does. That asymmetry is the migration — every `withUnlocked` bracket frees a gitdir locked by a previous version and never re-locks it, so one `savvy repos sync` migrates an existing checkout.

The deprecated `commit` alias on `RepoStatusEntry` is removed. Read `stagedCommit` instead. The alias carried one behavior nuance worth restating: a gitlink committed at `HEAD` but staged for removal read `null` through the alias, where the pre-triple `commit` field showed the committed oid.

## Features

`ReposManager.sync` and `ReposManager.add` declare the vendored boundary to git instead of leaving a permission error to announce it, writing `submodule.<path>.update = none` and `fetch.recurseSubmodules = false` into the superproject's local config. `add` asserts it too because it is a creation point: deferring to the next `sync` leaves a freshly vendored tree undeclared in the meantime, which is the window the marker exists to close. Neither is written to `.gitmodules`. `submodule.<path>.active` is deliberately left `true`: an inactive submodule reads as uninitialized in `git submodule status` even when fully checked out, which would make every drift report claim a missing worktree, and `git submodule init` flips it back regardless. `ReposSyncReport` gains `boundaryMarked`.

`ReposDrift.check` reconciles a fifth authority, the superproject's local git config, and reports two new drift kinds.

`localRegistrationDivergence` fires when a checkout is still registered under a pre-canonicalization section name. The manifest, `.gitmodules`, the index and the worktree can all agree while the local registration disagrees, which previously read as clean while `git submodule status` reported a healthy checkout as uninitialized. The module gitdir's own path is the precise link between the two names, since git names it after the registration name in force at creation and never renames it.

`nestedSubmoduleDivergence` fires when a vendored repo's own submodule is materialized and off the commit its pinned parent records. Sparse-checkout governs only the parent's tracked files, so a manifest `sparse` list never covers gitlink entries and a nested tree can present source from a version the manifest does not pin.

`ReposManager.add` accepts an `orientation` option and `ReposManager.remove` returns the whole removed entry as `removedEntry`. Remove-then-re-add is the standing remedy for several vendored-tree problems, and without these a caller following it destroyed the entry's orientation block with nothing downstream reporting the loss.

## Bug Fixes

`ReposManager.sync` and `ReposManager.restore` deinitialize a vendored repo's own submodules rather than reporting success while leaving them materialized. A plain reset does not recurse, so a diverged nested checkout previously survived every repair while keeping the parent permanently dirty, and `sparseApplied` named repos whose excluded directories were still on disk.

`ReposManager.restore` re-reads each worktree after resetting it and reports any repo that is still dirty in a new `stillDirty` field, so a reset that ran without achieving anything is no longer indistinguishable from one that worked.
