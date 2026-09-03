---
status: current
module: cli
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./architecture.md
  - ../silk-effects/architecture.md
  - ../mcp/repos-tools.md
  - ../testing/effect-vitest.md
dependencies:
  - ./architecture.md
  - ../silk-effects/architecture.md
---

# The `savvy repos` command group

The CLI half of the vendored-reference-repo lifecycle: one thin handler per `Repos.ReposManager` method, plus the `status --drift` reconciliation read. Business logic lives entirely in silk-effects' `Repos` namespace; these handlers decode flags, render, and set exit codes.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Subcommands](#subcommands)
- [Load-bearing behaviors](#load-bearing-behaviors)
- [Error policy and the group annotation](#error-policy-and-the-group-annotation)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`savvy repos` (`src/commands/repos/`) manages the read-only vendored source checkouts under `.repos/` — the manifest in `.repos/config.json`, the git submodules behind it, and the OS-level lockdown that keeps the worktrees read-only. Every mutating handler is an enforcement point for that boundary. The services it consumes (`Repos.ReposManager`, `Repos.ReposDrift`, `Repos.ReposConfigStore`, `Repos.ReposLockdown`) and their semantics are documented in the `Repos` subsystem doc reachable from `../silk-effects/architecture.md`; the layer wiring that supplies them is the `ReposGroup` in [architecture.md](./architecture.md#the-runtime-layer-stack). The same operations are exposed to agents as the MCP `repos_inspect`/`repos_manage` tools (`../mcp/repos-tools.md`).

## Current State

Complete: nine leaves under `src/commands/repos/commands/` cover the full `ReposManager` surface plus `ReposDrift` via `status --drift`, each with a handler test in `__test__/commands/repos/`. `reposCommand` carries its hand-written `Command.Command<...>` annotation (`Repos.GitSubmoduleError` / `Repos.ReposManager | Repos.ReposDrift`) and `types:check` is the gate that keeps it exact.

## Subcommands

```text
status [--json] [--drift]      render the manifest state; --drift reconciles it
sync                           reconcile submodules with the manifest: init
                               missing, apply sparse paths, clear locks
pin                            re-pin an entry to a new ref (staged, not
                               committed)
add                            vendor a new repo (staged, not committed)
note add|remove|promote <name> manage the per-entry agent notes; promote folds
                               one into the curated orientation (--into)
remove <name>                  drop an entry, submodule and worktree
rename <old> <new>             rename an entry and its paths
restore [names...]             hard-reset dirty checkouts (destructive)
deregister <section>           clear a stale submodule.<section> local-config
                               registration (the drift report's orphan case)
```

`src/commands/repos/index.ts` registers the leaves and re-exports the `runRepos*` handlers that the tests drive directly. `note` is a nested group whose leaves take the repo name as their first argument.

## Load-bearing behaviors

- **`status --drift` is two reads, in order.** The plain status report renders first (`ReposManager.status`), then `Repos.ReposDrift.check` reconciles the manifest, `.gitmodules`, the worktree, `git submodule status` and the superproject's local git config (plus a one-level-down probe of each vendored repo's own submodules), printing one line per finding (`<name>: <kind> — <detail>`). Either an unclean status report or any drift flips `process.exitCode` to 1. Both calls read the same manifest, so a missing manifest fails at the status call before the drift check runs — the friendly "nothing vendored yet" exit-0 case is unchanged by `--drift`. `--json` emits the structured report instead of the rendered text.
- **`restore` is the destructive one.** It hard-resets a vendored checkout back to its staged (or committed) gitlink commit and re-applies sparse paths, discarding uncommitted work by design. With no names it restores every dirty repo and reports the ones it skipped as clean; with explicit names it restores exactly those, clean or not, after validating that every name exists so a typo in a later name cannot leave earlier ones already reset. **It can also fail while succeeding:** `stillDirty` names every repo whose worktree is still dirty after the reset ran, and the handler logs a `WARNING … run \`savvy repos status --drift\`` line per name and sets `process.exitCode = 1`, because rendering a reset that never cleaned the tree as a plain success is exactly what let a nested-submodule divergence look repaired.
- **`remove` prints the removed entry's `orientation` block verbatim as JSON.** `ReposManager.add` accepts an `orientation` but resurrects nothing on its own, and the CLI `add` exposes no flag for it (the MCP `repos_manage` tool does), so anyone following the standard remove-then-re-add remedy loses that hand-curated block unless it is put in front of them at the moment it still exists — and no later report mentions it, since neither `status` nor `drift` knows an orientation was ever there. The notes warning beside it exists for the opposite reason: notes are ephemeral by policy, so the log is a last look before they go, not something to carry across.
- **`sync` deliberately renders nothing for `boundaryMarked`.** The report field is populated for every entry on every run (the boundary marker is re-asserted unconditionally), so logging it per entry would print a line per repo on every no-op sync, and folding it into the "up to date" idle check would suppress that line permanently. It stays in the structured report for callers that want to verify the assertion.
- **`deregister` touches local config only.** Nothing is staged, there is no friendly missing-manifest exit-0 case, and its error union has no `ReposLockdownError` — it never opens the worktree.

## Error policy and the group annotation

Each handler `catchTag`s the FULL error union its `ReposManager` method can produce — `ReposConfigError`, `GitSubmoduleError`, `RepoNotFoundError`, `NoteNotFoundError`, and `ReposLockdownError` for the six ops that unlock and re-lock the tree (`sync`, `add`, `pin`, `remove`, `rename`, `restore`) — down to a logged message and a non-zero exit code. Consequently `reposCommand`'s hand-written error annotation is `Repos.GitSubmoduleError` alone: the only channel left uncaught is the one `status`/`status --drift` let escape. Its requirements annotation names `Repos.ReposManager | Repos.ReposDrift`, the latter purely because of `status --drift`. Why the group carries a hand-written annotation at all, and why it must stay exact, is covered in [architecture.md](./architecture.md#why-some-command-groups-carry-a-hand-written-type-annotation).

`ReposGroup` in the layer stack provides `Repos.ReposLockdown` alongside `ReposConfigStore`/`Git` because the mutating ops apply the OS-level permissions boundary; `Repos.ReposDrift` needs no lockdown, being read-only.

## Boundaries and invariants

- **Handlers render outcome, not attempt.** A handler reports what the tree looks like after the operation (`stillDirty`, the removed `orientation`), never just that the operation ran.
- **A new mutating op must `catchTag` `ReposLockdownError`** if it unlocks the tree, or the group annotation's error channel widens and `types:check` fails — the annotation is the guard.
- **No business logic here.** Anything beyond flag decoding, rendering and exit codes belongs in silk-effects' `Repos` namespace, where the MCP `repos_manage` tool can share it.
- Handler tests (`__test__/commands/repos/`) stub `ReposManager`/`ReposDrift` per test and split output assertions by capture mechanism (`collectLogs` under `it.effect`, `collectStdout` under `it.live`) — see [architecture.md](./architecture.md#testing-the-command-handlers).

## Rationale

### Why one handler per `ReposManager` method

The vendored-tree operations are dangerous (`restore` discards work; `remove` deletes a submodule) and their safety rules — lockdown bracketing, name validation before any reset, boundary re-assertion — are the service's responsibility. Keeping the CLI to a one-to-one projection means the MCP tool and the CLI cannot diverge on those rules, and the only thing a handler can get wrong is what it shows the user, which is why the load-bearing list above is entirely about rendering and exit codes.
