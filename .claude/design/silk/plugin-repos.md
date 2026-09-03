---
status: current
module: silk
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./plugin.md
  - ./plugin-hooks.md
  - ./plugin-biome.md
  - ../silk-effects/architecture.md
  - ../mcp/architecture.md
  - ../cli/architecture.md
dependencies: []
---

# plugins/silk — vendored-repos capability

The [silk plugin](./plugin.md)'s layer over silk-effects' `Repos` namespace (manifest at `.repos/config.json`, git submodules under `.repos/`): a judgment-layer skill, an always-on SessionStart orientation block, three PreToolUse guards and a background drift monitor. Mutation happens only through the `repos_manage` MCP tool or `savvy repos`; the guards catch raw `Write`/`Edit`/`Bash`/MCP-git attempts, they do not replace the tool.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The enforcement split](#the-enforcement-split)
- [The repos skill](#the-repos-skill)
- [The orientation hook](#the-orientation-hook)
- [The three guards](#the-three-guards)
- [The gitmodules-drift monitor](#the-gitmodules-drift-monitor)
- [Preset exclusions](#preset-exclusions)
- [Rationale](#rationale)

## Overview

The pieces: `skills/repos/`, `hooks/session-start/repos-orientation.sh`, `hooks/pre-tool-use/repos-{fs,bash,mcp}-guard.sh` with `hooks/lib/repos-git-read-ops.txt`, and `monitors/gitmodules-drift.mjs`. The mechanism they wrap — manifest, submodules, lockdown — is silk-effects' `Repos` namespace, exposed through `savvy repos` and the `repos_inspect`/`repos_manage` tools.

## Current State

Implemented. The skill, hook, three guards and monitor ship as described; the guard headers and `tests/pre-tool-use-repos-*.bats` are authoritative for exactly which commands deny.

## The enforcement split

**The boundary is OS permissions; the guards are UX.** `Repos.ReposLockdown` (silk-effects, applied by every `repos_manage`/`savvy repos` lifecycle op) chmods each vendored worktree read-only and re-locks even when the op fails partway — see `../silk-effects/architecture.md#vendored-repos-repos-namespace`. That layer stops a write for every shape a pattern-matching guard misses. The lock is worktree-only: the submodule gitdir stays writable so ordinary git clients keep working, and the posture is declared to git by `sync`/`add` writing `submodule.<path>.update = none` into local config. A worktree lock does not stop `git checkout` inside a vendored tree, so the boundary's promise is "a drifted pin is always detected and one command from repaired" — the guards and the drift monitor are load-bearing parts of *detection*.

The guards exist because an `EACCES` deep inside a tool call is a bad teaching signal: the agent learns "permission problem", reaches for `chmod` and works around the boundary. A deny fires earlier, names the operation and points at the sanctioned path. Neither layer substitutes for the other — do not delete the guards because permissions cover it, and do not tighten a guard into an approximate sandbox because it is the only defense.

## The repos skill

`skills/repos/SKILL.md` (`/silk:repos`, `paths`-triggered on `.repos/config.json`) is the judgment layer: when vendoring is the right call versus training-data recall or a fork, sparse-checkout discipline, the re-pin-on-dependency-bump rule and the notes-vs-orientation editorial policy (notes are ephemeral and ref-stamped; orientation is durable). It documents every `repos_manage` action and `repos_inspect` mode and their `savvy repos` equivalents while deferring wire-format detail to the tools, and claims plain git-submodule vocabulary aimed at `.repos/` because this skill, not raw `git submodule`, is the sanctioned path. Its behavioral teachings cover the ways the tooling can *look* like it succeeded — carrying `orientation` across a remove-then-add by hand, `rename` having no rollback, nested submodules being a blind spot `sparse` cannot close — and the two rules every agent trips on: verify a pin with `git rev-parse HEAD` against `git ls-files -s`, never `git describe --tags` (a monorepo upstream resolves that to a sibling package's tag); and an `EACCES` inside `.repos/**` means *use the tooling*, never `chmod` the tree back.

## The orientation hook

`hooks/session-start/repos-orientation.sh` (no matcher; self-silences when `.repos/config.json` is absent) is the informational half. On every start it runs `savvy repos sync` as a best-effort side effect behind an internal watchdog (`SILK_REPOS_SYNC_TIMEOUT`, under the hook's own `hooks.json` timeout) that reaps the sync process **and** its children, so no orphan can hold a captured fd open and hang the caller. Sync outcome never gates the context block — a failed sync still renders the manifest with a stale-content warning, because that is when the warning matters. The block is budgeted (see `BUDGET` in the script): repos render in full in manifest order until the next would exceed it, then collapse to one line each pointing at `repos_inspect`.

## The three guards

All three deny only what visibly resolves to a `.repos/**` write, fail open on a missing `jq` or malformed envelope and document their accepted misses in their headers. Each deny message names the sanctioned primitive for that operation (`repos_manage` action / `savvy repos` subcommand) rather than telling the agent to ask. Only the fs and bash guards carve out `.repos/config.json`, the one hand-editable file.

- **`repos-fs-guard.sh`** (`matcher: "Write|Edit|NotebookEdit"`) is the precise leg: it resolves the tool's file path to an exact location and compares against `${PROJECT_DIR}/.repos/**`, with an exact-string carve-out for the manifest.
- **`repos-bash-guard.sh`** (`matcher: "Bash"`) pattern-matches the command, tuned for **precision over reach** since permissions do the enforcing. Every leg matches a derived `SCAN` — heredoc bodies and whitespace-containing quoted prose removed — never the raw command, so prose mentioning `.repos/` cannot trip it. The non-git leg does per-shape target analysis (a redirect checks its target, `cp`/`mv` their destination, `tee` its arguments; only `sed -i`/`rm`/`patch`/`dd` deny on any `.repos/` token), so reading or copying *out of* a vendored tree passes, and a `sed` *script* mentioning `.repos/` is recognized by shape and skipped. The git leg engages on any git clause naming `.repos/` and allows only read-by-nature subcommands (`hooks/lib/repos-git-read-ops.txt`) plus a flag-aware classifier for `config`/`submodule`/`remote`, whose read/write nature depends on flags rather than name. Sanctioned exceptions are policy, not regex trivia: `git rm --cached` (index-only, re-points a gitlink) passes while bare `git rm` and `git mv` do not; staging `.repos/config.json` passes; dropping a stale local submodule registration passes because that is the drift remedy no tool performs. Unlike the Biome nudge, a deny holds inside a dispatched subagent's Bash call too. The header comment and `tests/pre-tool-use-repos-bash-guard.bats` are the authoritative catalog.
- **`repos-mcp-guard.sh`** (the GitKraken/GitHub MCP matcher) denies when the op is a write and the stringified `tool_input` contains `.repos/` at all — conservative by design, since an MCP git op is a coarser signal than a path. It composes with `commit-mcp.sh` on the same matcher.

A false-positive deny or drift the guards missed is recoverable through the same path they point at: `repos_inspect` to see state, `repos_manage`/`savvy repos` to reconcile.

## The gitmodules-drift monitor

`monitors/gitmodules-drift.mjs` is the passive half. It watches `.gitmodules` and `.repos/config.json` and on a change runs `savvy repos status --drift --json`, printing one line per finding. Load-bearing properties:

- **One delayed startup sweep, then watch.** Watching alone cannot see pre-existing drift, and two drift kinds touch neither watched file (a stale registration lives in `.git/config`; a diverged nested submodule lives inside a vendored tree). The sweep is delayed (`STARTUP_SWEEP_DELAY_MS`, env-overridable) to clear the orientation hook's sync, `unref`'d, and not routed through the debounce.
- **Notify-only.** Filesystem and one read-only subprocess; no network, no reconciliation — fixes are lifecycle ops the agent runs.
- **Fails open, silently.** A `savvy --version` probe gates the call, so a project without the CLI produces no output. Exit code 1 is data (the CLI exits 1 on drift), not failure.
- **Debounced `fs.watch`, not polling**, because an editor's write-then-rename fires several events for one change; a missing `.repos/` is handled by watching the root for its creation.

## Preset exclusions

`.repos/` is excluded from the Biome asset (`packages/silk/public/biome/silk.json`) and the markdownlint template in silk-effects, so a vendored tree's own lint drift never surfaces as this repo's problem. This exclusion is also why direct Bash Biome is denied — see [plugin-biome.md](./plugin-biome.md). The shared tsconfig bases need no equivalent: their `include` globs are allowlists that never reach `.repos/**`.

## Rationale

Vendored source is reference material, not code this repo owns, so the whole capability is built to make *reading* frictionless and *writing* impossible without the tool. Permissions enforce that; the guards exist only because a bare `EACCES` teaches the wrong lesson, and the monitor exists because the one write permissions cannot stop — a checkout inside a vendored tree — has to be detected instead. Each layer is sized to its job rather than stretched to cover another's.
