---
module: silk-effects
category: architecture
status: current
completeness: 95
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
  - ../silk/plugin.md
---

# Vendored repos

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The four services](#the-four-services)
- [The boundary](#the-boundary)
- [Lifecycle operations](#lifecycle-operations)
- [Drift reconciliation](#drift-reconciliation)
- [Consumer consequences](#consumer-consequences)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`Repos` (`src/repos/`, `export * as Repos`) owns the vendored-reference-repo mechanism: a manifest at `.repos/config.json`, git submodules under `.repos/` and the permissions boundary that keeps those checkouts read-only. It backs `savvy repos` and the MCP `repos_inspect`/`repos_manage` tools (`../cli/architecture.md`, `../mcp/architecture.md`); the plugin-side guard layer is in `../silk/plugin.md`.

## Current state

Implemented across the whole lifecycle (`status`, `sync`, `add`, `pin`, `note`, `remove`, `rename`, `restore`, `deregister`) with drift reconciliation over five authorities. Git plumbing goes through `@effected/git`'s `Git`, whose typed failures map onto this module's `GitSubmoduleError`. The memfs carve-out in [Testing strategy](./architecture.md#testing-strategy) applies to the lockdown and lock-file tests here.

## The four services

- **`ReposConfigStore`** (`services/config-store.ts`) reads and writes the validated manifest, failing with `ReposConfigError` (`kind: "missing"` is the friendly, exit-0 case for a repo that vendors nothing). Its `update(root, fn)` is a serialized read-modify-write: an exclusive-create lock file beside the manifest (`wx` open, retried with backoff capped at a couple of seconds — long enough to ride out a contending writer, short enough that a crashed holder's lock fails fast), an absent manifest handed to `fn` as empty so `update` can initialize and the lock always released via `Effect.ensuring`. Every `ReposManager` manifest mutation goes through `update`, never a bare read-then-`write`.
- **`ReposManager`** (`services/manager.ts`) is the submodule plumbing and the whole lifecycle — see [Lifecycle operations](#lifecycle-operations).
- **`ReposDrift`** (`services/drift.ts`) is the read-only reconciler — see [Drift reconciliation](#drift-reconciliation). Its layer deliberately does not require `ReposLockdown`, because it never writes and runs unmodified against a locked tree.
- **`ReposLockdown`** (`services/lockdown.ts`) is the boundary itself. `lock` chmods a vendored tree to files `0444`/directories `0555` (preserving each file's executable bit), `unlock` restores `0644`/`0755` and the walk skips symlinks entirely (no `lchmod` on Linux, and following one would touch whatever it points at). Failures surface as `ReposLockdownError`.

Every `manifest.repos[name]` membership read goes through the `Object.hasOwn`-guarded `getRepoEntry` helper, never a bare bracket read: a manifest key literally named `constructor` must fail typed as `RepoNotFoundError`, not resolve an inherited `Object.prototype` member.

## The boundary

- **The OS permissions are the boundary; the plugin's Bash/fs/MCP guards are early-warning UX in front of it.** A guard can only pattern-match a command string and has documented misses; a `0444` file has none. Neither substitutes for the other.
- **The lock covers the worktree only; the submodule's git metadata directory is deliberately left writable.** Locking the gitdir made the boundary enforce itself solely through an `EACCES` naming neither `.repos/` nor a reason, and broke ordinary tooling: a plain `git pull` recurses into submodules by default and dies writing `FETCH_HEAD`, and any client keeping per-gitdir state (GitKraken writes a `gk/` directory into every gitdir it manages) is structurally incompatible. Verified against git 2.54, the worktree lock still blocks editing a vendored file and `git reset --hard`, but not `git checkout <other>`, which moves `HEAD` and leaves the worktree stale. So the invariant is **"a drifted pin is always detected and one command from repaired"** (drift reports `checkoutDiverged`, `restore` repairs), not "the pin cannot drift". `lock` and `unlock` are asymmetric on purpose: `unlock` still walks the gitdir so a tree locked by the previous implementation is freed, while `lock` never re-locks it — one `savvy repos sync` migrates an existing checkout. Do not "fix" the asymmetry.
- **The other half of the boundary is declarative, written by both `sync` and `add`.** Both write `submodule.<path>.update = none` and `fetch.recurseSubmodules = false` into the superproject's *local* config — never `.gitmodules`, because this is a property of this checkout's workflow. `update = none` makes `git submodule update`, `git pull --recurse-submodules` and every GUI client driving them skip the tree deliberately instead of discovering the boundary through a permission error. `add` asserts it too because it is a creation point. Since `update = none` also makes `git submodule update --init` skip, `sync`'s initialize call passes `checkout: true` (git's documented `--checkout` override) rather than ever rewriting the key. `submodule.<path>.active` is left `true`: an inactive submodule reads as uninitialized in `git submodule status`, which would make every drift report claim `missingWorktree`.
- **The metadata dir is derived from the checkout, never assumed.** `resolveModuleDir` reads the worktree's `.git` file (a `gitdir:` pointer) and resolves it, because git names `.git/modules/<path>` after the path the submodule was *registered* under — which need not be the manifest key, and git never renames it. It degrades to the name-based path when the pointer is unreadable, and refuses a pointer that resolves outside `root`. The same derivation lets drift report `localRegistrationDivergence` precisely: the gitdir path *is* the real registration name.
- **Traversal order differs by direction.** Locking chmods a directory after recursing into it; unlocking chmods it before. Inverting either fails with `EACCES` on the tree it just locked.
- **`withUnlocked(root, name, effect)` owns the whole finalizer contract.** It runs `unlock`, runs `effect` only if unlock succeeded (restoring interruptibility around it), then always runs `lock` — including when unlock failed part-way or the effect was interrupted — so the tree never sits open on an aborted path. A relock failure surfaces as `ReposLockdownError` only when it is the sole failure; an unlock or inner failure always wins. Mutating operations issue no trailing `lock` of their own. `rename` hand-rolls the same contract because the tree it unlocks (`oldName`) and the tree it must relock (`newName`) are different paths; it tracks which name to relock and flips it the instant `git mv` returns.

## Lifecycle operations

- **`status`** reports presence, dirtiness and stale note ids plus an index-aware commit triple: `stagedCommit` (the gitlink oid in the index — the only place a staged-but-uncommitted pin is visible), `committedCommit` (at `HEAD`) and `checkedOutCommit` (inside the worktree). An empty `ls-tree` listing is a legitimate non-error; a failing invocation propagates; only `NotARepositoryError` from `revParse` folds to "no checkout" — any other failure is a present-but-corrupt repository, which is what `status` exists to surface.
- **`sync`** clears stale `index.lock`/`shallow.lock` files older than `STALE_LOCK_MAX_AGE_MS` (a younger lock may still be held by a live git process), initializes absent checkouts shallowly, re-applies sparse patterns on every run, reconciles a `.gitmodules` URL that drifted from the manifest (`urlSynced`), registers an orphan manifest entry that has neither worktree nor section (`registered` — a section without a worktree is a prior `add`'s partial state, not an orphan), asserts the declarative boundary on every entry (`boundaryMarked`, kept in the structured report but not logged per entry because a field that is never empty is never news) and deinitializes a vendored repo's own submodules before applying sparse patterns, because sparse-checkout governs only the parent's tracked files and a nested checkout would otherwise survive untouched.
- **`add`** is atomic with remote ref validation up front. The order is load-bearing: validate the name against `RepoName` before any side effect; read the manifest treating only `kind: "missing"` as absence so a transient I/O error never reinitializes over a real manifest; reject a duplicate; `git ls-remote` the ref and fail with a near-miss suggestion list when unknown, so an unresolvable ref leaves no gitlink, section or worktree. Inside the unlocked bracket it resumes a prior `add`'s partial state when path and url match (a different url fails typed rather than overwriting), and everything after is rollback-guarded — each rollback step's failure is logged and swallowed independently and the original failure always propagates. The rollback resolves the module gitdir *first*, while the `.git` pointer still exists, because `submodule deinit --force` clears it. `add` declares the boundary itself and takes an optional `orientation`, which is what makes remove-then-re-add — the standing remedy for several vendored-tree problems — lossless in one call; notes are deliberately not carried across.
- **`pin`** re-pins an entry; **`note`** adds, removes or promotes an agent note, where `promote` appends to the target document rather than overwriting it.
- **`remove`** unvendors: `submodule deinit --force`, `git rm --cached`, delete the worktree and module gitdir (inside the unlock bracket, so the relock walk over a missing directory is a silent success), drop the `.gitmodules` section, remove the manifest entry. The result carries `removedNotes`, a ready-made `commitMessage` and `removedEntry` — the whole entry as it stood, whose `orientation` hands straight back to `add`. `removedNotes` duplicates `removedEntry.notes` deliberately: opposite lifetimes (a last look at something ephemeral versus the durable block to carry forward).
- **`rename`** validates the new name and non-collision first, then `git mv` moves the worktree and rewrites `.gitmodules`' `path` and `core.worktree` (verified against git 2.54). `core.worktree` is nevertheless re-asserted in the module's `config` and, when present, its `config.worktree` — the latter is *always* stale after a move — written as `path.relative(moduleDir, path.resolve(root, newRepoPath))` (git resolves it against the gitdir; `resolve` first because the CLI's `--cwd` defaults to a literal `"."`). Both writes run from `root` with an absolute `-f` path into the module dir, never `cwd: moduleDir`, because with `extensions.worktreeConfig` set git reads the stale `config.worktree` during discovery and dies. The `.gitmodules` section *name* is canonicalized to the new path by locating the section via its updated `path` field, then `submoduleInit` re-registers the superproject's `submodule.<name>.*` keys under the new name (git writes them only on `add`/`init`, so a renamed entry otherwise reads as uninitialized forever) and the old keys are unset tolerantly. **Known limitation, deliberate:** the module gitdir is not relocated on disk, so vendoring a new repo under the freed old name hits git's refusal to reuse an existing local gitdir — a typed failure, not silent corruption.
- **`restore`** hard-resets checkouts to their gitlink commit and re-applies sparse paths. The staged gitlink wins over the committed one; with neither it fails typed. With explicit names it validates every name before resetting any and restores each regardless of cleanliness; with none it restores every dirty repo and reports the clean ones in `skippedClean`. It deinitializes the repo's own submodules before the reset (a reset does not recurse and sparse cannot evict a nested checkout), then re-reads `git status` inside the bracket and reports anything still dirty in `stillDirty` — the CLI warns and exits 1, the MCP renders a failure section only when non-empty. Reports state what was achieved, not attempted.
- **`deregister`** clears a stale `submodule.<section>.*` registration from the superproject's local config — the orphan `localRegistrationDivergence` a rename or unvendoring leaves behind, which `git submodule status` lists as a phantom. It refuses, typed and before any mutation, a section outside `.repos/` (a host repo's own submodules are not this machinery's to clear) and a *live* registration under either name — the canonical `.repos/<key>` of a manifest entry, or a diverged name identified by the same gitdir attribution drift uses — with one carve-out: a gitdir match whose entry's canonical section is *also* registered is a genuinely orphaned twin and clearing it is a crashed-rename recovery's final step. It treats a missing manifest as empty, probes via `configList` pinned to the repository-local config file before removing (a global-only section would pass a merged-view probe and then die on the local-scoped removal), reports `removedKeys` as read before removal and reuses drift's `submoduleNameFromKey` so report and remedy never disagree. It touches no worktree, so it is the one mutating operation with no lockdown bracket and no `commitMessage`.

## Drift reconciliation

`ReposDrift.check(root)` reconciles five authorities — the manifest, `.gitmodules`, the worktree, `git submodule status` and the superproject's local git config — and looks one level down into each vendored repo's own submodules, returning a `ReposDriftReport`. The `DriftKind` literals are in `schemas/drift.ts`. Five decisions are load-bearing:

- **Sections are matched by canonical name first, never by `path`.** `git submodule add` derives the name from the path, so `section.name` normally equals `.repos/<key>` — and matching on `path` would hide the `pathMismatch` this loop exists to report.
- **Name-pairing failure falls back to pairing by `path`, claiming each section at most once**, so a re-slugged entry is reported as `pathMismatch` with the remaining checks still run, rather than degrading into an `unregisteredManifestEntry` + `orphanGitmodulesEntry` pair that masks them. Unclaimed sections are `orphanGitmodulesEntry`.
- **A `.gitmodules` parse failure is the sole drift, not an error** (`gitmodulesUnparsable`, named `.gitmodules`); an *absent* `.gitmodules` instead makes every entry `unregisteredManifestEntry`. Submodule states map on: `uninitialized` → `missingWorktree`, `outOfSync` and `conflict` → `checkoutDiverged` (with detail naming the conflict).
- **The local git config is the fifth authority, and the module gitdir's own path is what makes reading it precise.** `submodule.<name>.*` is unversioned, written only by `add`/`init` and keyed by section name, so after a canonicalization the other four authorities can all agree while the checkout is still registered under the old name. Comparing each entry's gitdir path (relative to `.git/modules`) against its canonical section name detects that as `localRegistrationDivergence`, whose remedy is `git submodule sync` + `init`; the orphan variant (a `submodule..repos/*` section matching nothing) carries the `savvy repos deregister` remedy instead. Config keys are parsed by stripping the fixed prefix and the final property segment, never by splitting on `.`, since a submodule name is routinely a path.
- **A vendored repo's own submodules are checked one level down, and a failure there is swallowed.** A nested initialized submodule sits outside every authority above — which is how a repo pinned at one version presents source from another — and is reported as `nestedSubmoduleDivergence` pointing at `restore`. The probe uses `Effect.orElseSucceed` so a nested-status hiccup cannot turn the whole report into an error.

## Consumer consequences

`sync`, `add`, `pin`, `remove`, `rename` and `restore` widen their error channel with `ReposLockdownError`; the CLI handlers `catchTag` the full union (log, `exitCode = 1`) so the command's own channel narrows to `GitSubmoduleError`, and the MCP keeps `ReposLockdownError` in `repos_manage`'s union. Reads (`status`, `ReposDrift.check`, `repos_inspect`) work unchanged against a locked tree, and `.repos/config.json` is host-repo content that is never locked. Consumers: `savvy repos`, the MCP `repos_*` tools and the plugin's `gitmodules-drift` monitor.

## Rationale

### Why permissions rather than guards alone

The guards see a command string; the filesystem sees every write, from every tool, including ones no guard was written for. Making the OS the boundary and the guards the explanation is the only arrangement where a miss in the guard list is an inconvenience rather than a corrupted reference tree.

### Why reports state achievement

A `restore` that ran over a tree that never came clean, or a `sync` that reported sparse patterns applied while a nested checkout survived, is worse than a failure: it tells the operator the problem is fixed. Every report field added to this namespace exists to close one such gap.

## Related documentation

- [Architecture overview](./architecture.md)
- [`../cli/architecture.md`](../cli/architecture.md) — `savvy repos`
- [`../mcp/architecture.md`](../mcp/architecture.md) — `repos_inspect`/`repos_manage`
- [`../silk/plugin.md`](../silk/plugin.md) — the guard layer and the drift monitor
