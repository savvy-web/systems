---
"@savvy-web/silk-effects": minor
---

## Features

### `ReposLockdown`: OS-level read-only permissions for vendored repos

New `Repos.ReposLockdown` service (`Repos.ReposLockdownShape`, `Repos.ReposLockdown.layer`) chmods a vendored repo's working tree and its `.git/modules` gitdir to read-only (`0444` files, `0555` directories) after every mutation, and back to writable around a deliberate one. `lock`/`unlock` walk both trees recursively; `withUnlocked` wraps an effect so the tree is writable only for its duration, re-locking even on failure.

`ReposManager.sync`, `.add`, and `.pin` now call `withUnlocked` around their git mutations and lock the tree once they finish, so a vendored repo stays chmod-read-only outside those three entry points — accidental edits fail at the filesystem level instead of only being caught by the repos Bash guard hook. All three methods' error channels gain the new `ReposLockdownError` (also exported), and `ReposManager.layer` now additionally requires `ReposLockdown` alongside its existing dependencies.

A consumer assembling `ReposManager.layer` by hand needs to provide `Repos.ReposLockdown.layer` (platform-only requirements: `FileSystem`/`Path`) in addition to `ReposConfigStore` and `Git`.
