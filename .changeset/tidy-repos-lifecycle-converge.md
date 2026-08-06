---
"@savvy-web/silk-effects": minor
---

## Features

### `ReposManager` gains full lifecycle operations: `remove`, `rename`, `restore`

`ReposManager` now supports the complete vendored-repo lifecycle alongside the existing `status`/`sync`/`add`/`pin`/`note`:

- `remove(root, name)` — unvendors a repo: deletes the gitlink and module gitdir, drops the `.gitmodules` section, and removes the manifest entry. Its notes are returned on the result so any durable ones can be promoted elsewhere before the removal is committed.
- `rename(root, oldName, newName)` — moves the `.repos/<name>` worktree, re-points the module gitdir's `core.worktree` in both git config locations, canonicalizes the `.gitmodules` section name, and renames the manifest key.
- `restore(root, names?)` — hard-resets one or more vendored repos back to their staged (or committed) gitlink commit and re-applies sparse-checkout paths. Called with no names, it restores every dirty repo and reports which ones were already clean and skipped; called with explicit names, every one of them is restored regardless of cleanliness.

All three widen `ReposManager`'s error channel with `ReposLockdownError` (see below).

### `ReposManager.add` is now atomic, with ls-remote ref validation

`add` now validates the requested ref against the remote via `git ls-remote` before vendoring anything. An unresolvable ref fails with a near-miss suggestion list (e.g. `ref "mian" not found at <url>; did you mean: main, maint?`) instead of a bare git error. If any step of the vendor sequence fails partway, `add` rolls back what it already did rather than leaving a half-initialized submodule; interrupted state is resumable on a subsequent `add` call for the same repo.

### `ReposDrift`: read-only four-authority reconciliation

New `Repos.ReposDrift` service (`Repos.ReposDrift.layer`, needs `ReposConfigStore | Git | FileSystem | Path`) reconciles the manifest, `.gitmodules`, the worktree, and `git submodule status` for every vendored repo and reports every disagreement it finds via `check(root)`, returning a `ReposDriftReport` (`{ drifts: RepoDrift[], clean: boolean }`). Each `RepoDrift` names the repo, a `kind` (`urlMismatch`, `pathMismatch`, `unregisteredManifestEntry`, `orphanGitmodulesEntry`, `missingWorktree`, `checkoutDiverged`, `missingShallow`, `gitmodulesUnparsable`), a human-readable `detail`, and — for value mismatches — the disagreeing `manifestValue`/`observedValue` pair. `check` is read-only: it never stages anything and runs unmodified against a `ReposLockdown`-locked tree. Surfaced by `savvy repos status --drift` and the `mcp` `repos_inspect` drift mode.

### Index-aware repo status

`ReposManager.status` now reports three distinct commit fields per repo instead of one: `stagedCommit` (the gitlink oid staged in the index, visible before a pin is committed), `committedCommit` (the oid committed at `HEAD`), and `checkedOutCommit` (what's actually checked out in the submodule worktree). The existing `commit` field is retained as a deprecated alias of `stagedCommit` for one release.

### `ReposManager.sync` reconciles submodule URLs and registers orphan manifest entries

`sync` now also reconciles a `.gitmodules` submodule URL that has drifted from the manifest (reported as `urlSynced`) and registers manifest entries with no corresponding gitlink at all (reported as `registered`), in addition to its existing initialize/sparse-apply/stale-lock-clearing behavior.

## Bug Fixes

- `ReposManager.note`'s `promote` operation now appends the note to the target document (`layout` or `startHere`) instead of overwriting it.
- `ReposConfigStore.update` now serializes manifest reads and writes behind an exclusive lock file, so concurrent callers queue instead of racing a lost update.
