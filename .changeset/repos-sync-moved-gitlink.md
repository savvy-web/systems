---
"@savvy-web/silk-effects": minor
---

## Features

- `Repos.ReposSyncReport` gains `advanced` and `skippedDirty`. `ReposManager.sync` now compares a populated checkout's `HEAD` with the gitlink the superproject records (staged first, then committed). A clean checkout that is behind is checked out onto that commit, verified and reported in `advanced`. A dirty one is left untouched and reported in `skippedDirty`. `upToDate` now means nothing changed.

## Bug Fixes

- `sync`, `pin` and the other lockdown-bracketed operations work inside a linked git worktree. The module gitdir is resolved through the worktree's `.git` file, so its fallback lands under the worktree's own git dir rather than running through the file. A pointer under that git dir passes the containment guard, and a module-gitdir probe that fails because the path runs through a file is skipped instead of aborting the command. `ReposDrift` and `deregister` resolve the modules root the same way.
