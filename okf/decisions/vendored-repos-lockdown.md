---
type: Decision
title: Enforce vendored-repo read-only via OS permissions, not guards alone
description: "Repos.ReposLockdown chmods vendored worktrees read-only as the actual boundary; the plugin's Bash/fs/MCP guards are early-warning UX in front of it, not a substitute for it."
status: draft
tags: [security, tooling]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 20d8d8ac0796bcf49fdff69cd38804e38ceab5a99771516c2ca134fcd558ea26
sources:
  - id: silk-effects-repos
    resource: ../../packages/silk-effects/src/repos/services/lockdown.ts
  - id: plugin-repos
    resource: ../../plugins/silk/hooks/pre-tool-use/repos-fs-guard.sh
---

# Enforce vendored-repo read-only via OS permissions, not guards alone

## Context

`.repos/` holds vendored reference source (git submodules managed by
`Repos`, `src/repos/`) that agents must be able to read freely but never
write — it is reference material this repo does not own, tracked so
drift is visible in git history. Both mutation surfaces available to an
agent — direct filesystem writes and direct git plumbing — needed to be
closed without breaking the ordinary git tooling (a plain `git pull`
recursing into submodules, GUI clients keeping per-gitdir state) that
operates on the rest of the repository.

## Decision

Enforce the read-only boundary at the OS permissions layer, with the
plugin's guards as an explanatory layer in front of it, not a replacement:

- **`ReposLockdown`** (`src/repos/services/lockdown.ts`) `lock`s a
  vendored tree by chmodding files `0444` and directories `0555`
  (preserving each file's executable bit); `unlock` restores `0644`/`0755`.
  The walk skips symlinks entirely — there is no `lchmod` on Linux, and
  following a symlink would touch whatever it points at instead. Every
  `repos_manage`/`savvy repos` lifecycle mutation runs inside this
  lock/unlock bracket.
- **The lock covers the worktree only; the submodule's git metadata
  directory (`.git/modules/<path>`) stays writable.** Locking the gitdir
  made the boundary enforce itself through an unlabeled `EACCES` and broke
  ordinary tooling — a plain `git pull` recurses into submodules by
  default and dies writing `FETCH_HEAD`, and any client keeping
  per-gitdir state (GitKraken writes a `gk/` directory into every gitdir
  it manages) is structurally incompatible with a locked gitdir.
- **The declarative half is `submodule.<path>.update = none` and
  `fetch.recurseSubmodules = false`, written into the superproject's
  *local* config** (never `.gitmodules`, since this is a property of this
  checkout's workflow) by both `sync` and `add`. This makes
  `git submodule update`, `git pull --recurse-submodules`, and every GUI
  client driving them skip the tree deliberately instead of discovering
  the boundary via a permission error.
- **The plugin's Bash/fs/MCP guards (`repos-{fs,bash,mcp}-guard.sh`) are
  the UX layer, not the enforcement layer.** They deny a raw `Write`/
  `Edit`/`Bash`/MCP-git attempt that visibly resolves to a `.repos/**`
  write, firing before a bare `EACCES` teaches an agent to `chmod` its way
  past the boundary. A guard can only pattern-match a command string and
  documents its own accepted misses; a `0444` file has none.
- **The invariant is "a drifted pin is always detected and one command
  from repaired," not "the pin cannot drift."** A worktree lock does not
  stop `git checkout <other>` inside a vendored tree (verified against
  git 2.54) — that moves `HEAD` and leaves the worktree stale without
  triggering any write-permission check. `ReposDrift.check` (reconciling
  five authorities: the manifest, `.gitmodules`, the worktree, `git
  submodule status`, and the superproject's local git config) and the
  `gitmodules-drift` monitor exist to detect exactly that gap; `savvy
  repos restore` repairs it.

See [modules/silk-effects.md](../modules/silk-effects.md). The imperative
handling rules for contributors and agents working near `.repos/` are in
[conventions/vendored-repos-handling.md](../conventions/vendored-repos-handling.md).

## Alternatives rejected

- **Guards alone, no filesystem enforcement.** Rejected: a guard sees only
  a command string, so any tool call shaped in a way no guard anticipated
  passes through untouched. Neither layer substitutes for the other, but
  of the two, only permissions see every write from every tool.
- **Locking the submodule gitdir along with the worktree.** Rejected:
  breaks a plain `git pull --recurse-submodules` and any GUI client that
  keeps per-gitdir state, and produces an `EACCES` that names neither
  `.repos/` nor a reason instead of a clear deny.
- **Treating a `git checkout` inside a vendored tree as preventable.**
  Rejected as a design goal: no permission scheme stops `HEAD` from
  moving inside a writable-by-git-plumbing worktree without also breaking
  git's own internal writes during checkout. Detection (drift reporting
  `checkoutDiverged`) plus a one-command repair (`restore`) is the
  achievable and honestly-stated guarantee.

## Consequences

- Reads (`status`, `ReposDrift.check`, `repos_inspect`) work unchanged
  against a locked tree; only mutation paths widen their error channel
  with `ReposLockdownError`.
- `.repos/config.json` itself is the one hand-editable file, carved out of
  the fs and bash guards by exact-string match — it is host-repo content,
  never locked.
- `lock` and `unlock` are asymmetric on purpose: `unlock` still walks the
  gitdir so a tree locked by a previous implementation is freed, while
  `lock` never re-locks the gitdir. This asymmetry must not be "fixed" —
  it is the migration path for an existing checkout via one `savvy repos
  sync`.
- Any `EACCES` surfacing inside `.repos/**` means route the change through
  `repos_manage` / `savvy repos`, never `chmod` the tree back by hand.
