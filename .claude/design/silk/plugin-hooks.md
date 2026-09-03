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
  - ./plugin-changesets.md
  - ./plugin-commit-messages.md
  - ./plugin-biome.md
  - ./plugin-repos.md
  - ./plugin-dogfood.md
  - ./plugin-it2.md
  - ../mcp/architecture.md
dependencies: []
---

# plugins/silk — hook infrastructure and session orientation

How the silk plugin's hooks are registered, what they share, and the always-on orientation payload that directs the agent toward the `savvy-mcp` tools. Part of the [silk plugin](./plugin.md); individual guards are documented with their capability.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Registration](#registration)
- [SessionStart: three hooks, split by responsibility](#sessionstart-three-hooks-split-by-responsibility)
- [The orientation payload](#the-orientation-payload)
- [Session env namespace](#session-env-namespace)
- [Working-tree resolution](#working-tree-resolution)
- [Shared conventions](#shared-conventions)
- [Rationale](#rationale)

## Overview

`plugins/silk/hooks/` holds one `hooks.json` registry, per-event script directories (`session-start/`, `pre-tool-use/`, `post-tool-use/`, `stop/`) and a shared `lib/`. This doc covers the infrastructure every hook shares; the per-capability docs cover what each guard decides.

## Current State

Implemented. The three SessionStart hooks, the `SILK_*` env plumbing and the two project-dir resolvers described below are what ships; `hooks.json` and the `lib/` headers are authoritative for the exact registrations and contracts.

## Registration

`hooks/hooks.json` is the single registry. Several guards share a matcher — `Bash`, `Write|Edit|NotebookEdit` and the GitKraken/GitHub MCP regex (`mcp__(gk|gitkraken|GitKraken)__.*|mcp__github(-[^_].*)?__.*`) each carry multiple entries — and a deny from any one of them wins. The standing hygiene rule when adding a guard on a shared matcher is to check the existing entries for double-fires. `hooks.json` is the authoritative list of which script sits on which event.

Every hook reads its JSON envelope from stdin, fails open on missing `jq` or a malformed envelope (`read_envelope_or_noop`) and always exits 0 — the emitted JSON is the decision signal (`hooks/lib/hook-output.sh`).

## SessionStart: three hooks, split by responsibility

- **`session-start/orientation.sh`** — no matcher, so it fires on every start including resume and compact. It is the env **producer** (see [Session env namespace](#session-env-namespace)) and emits the always-on `<silk_capabilities>` block described below.
- **`session-start/startup-only.sh`** — `matcher: "startup"`, fresh starts only. It runs the `savvy commit hook session-start` side effect (stdout redirected so it cannot pollute the hook JSON) and emits the edit-time contract: the Silk-system intro, the blocking lint rules, the `<pre_commit_pipeline>` block naming every lint-staged autofix and the LSP-first `<running_tools>` preference order. A SessionStart hook cannot block, so its missing-`CLAUDE_PROJECT_DIR` guard emits a noop rather than failing the session.
- **`session-start/repos-orientation.sh`** — no matcher, but self-silencing whenever `.repos/config.json` does not exist. See [plugin-repos.md](./plugin-repos.md).

## The orientation payload

`orientation.sh` emits one `<silk_capabilities>` block that is deliberately **compact and index-shaped**, because it re-fires on every resume and compact: a one-line-per-tool `<mcp_tools>` index closing with a pointer that parameter and mode detail lives on each tool's schema, a one-sentence `<agents>` index with the proactive-dispatch nudges (`changeset-manager` when implementation work concludes, `tsdoctor` when a build reports API Extractor issues), a `<skills>` name list, a short `<biome>` division of labor, a conditional `<terminal>` sub-block and a prose `<active_hooks>` note. The rule, recorded in the hook's header comment: duplicated or on-demand-loadable detail does not belong in an always-on payload — per-tool detail duplicates the tool schemas, per-skill descriptions duplicate skill frontmatter, agent scope duplicates the agent listing. Depth lives at point-of-use: the path-triggered skills and the PreToolUse nudges.

The `<terminal>` sub-block is the one conditional entry. It renders only behind a cheap, prompt-free gate (iTerm2 env AND `it2` on `PATH`, no it2 subprocess) — see [plugin-it2.md](./plugin-it2.md).

The payload's tone is judgment-framed rather than imperative: a structured answer from a tool beats one reconstructed from shell stdout or memory, with Bash as the escape hatch. This is the "direction" half of the information-vs-direction split with `../mcp/architecture.md`.

## Session env namespace

Claude Code auto-sources `$CLAUDE_ENV_FILE` into Bash-tool subprocesses but NOT into hook subprocesses. The producer therefore writes the `SILK_*` vars (project dir, data dir, plugin root, session id, package manager) both to `$CLAUDE_ENV_FILE` and to a per-session `silk-hook.sh` under `~/.claude/session-env/<session_id>/`; reader hooks and skill scripts pick them up via `hooks/lib/source-session-env.sh`, which sources every `*hook*.sh` in that dir so multiple plugins coexist. Opt-outs and toggles follow the same namespace (`SILK_SKIP_CHANGESET_NUDGE`, `SILK_HOOK_DEBUG`).

**`SILK_PROJECT_DIR` is not a project-dir override for hooks.** It names the session's **primary checkout** and does not track the directory an individual tool call runs in.

## Working-tree resolution

`hooks/lib/hook-env.sh` is where hooks resolve the envelope and the working tree. `resolve_project_dir` takes the envelope's `cwd` **first**, then `SILK_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`. That order is load-bearing: both env vars are pinned to the primary checkout for the whole session and only `cwd` follows a git worktree. Agents routinely work in `.claude/worktrees/agent-*/` on their own branch, so a hook that resolves git state from an env var inspects a tree unrelated to the call it is handling. Ranking `SILK_PROJECT_DIR` above `cwd` silently reinstates that bug in every real session.

**Standalone skill scripts (no envelope) resolve separately**, via `hooks/lib/resolve-cli-project-dir.sh`. The caller's `$PWD` (`git rev-parse --show-toplevel`) is primary; `SILK_PROJECT_DIR` is an EXPLICIT override there (with a stderr `NOTICE` when it differs); `CLAUDE_PROJECT_DIR` disagreeing with cwd is ignored when both are worktrees of the same repository and refused when they are genuinely different repositories. The file's header comment is the full contract.

## Shared conventions

- **Canonical lib, no per-plugin duplicates.** Every hook sources `hooks/lib/hook-output.sh`, `hook-debug.sh` and `hook-env.sh`; the Biome hooks additionally share `split-segments.sh` (see [plugin-biome.md](./plugin-biome.md)); CLI-calling hooks share `run-cli.sh`.
- **Hook scripts carry no exec bit.** They commit as `100644`: the lint-staged ShellScripts handler strips the bit and nothing needs it, since `hooks.json` and the bats runner invoke every hook as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/..."`. A new 644 script next to older 755 siblings is intentional normalization, not drift. The same note lives in `tests/README.md` and `lib/configs/lint-staged.config.ts`.
- **Guards are tripwires, not the security boundary.** Every deny hook pattern-matches the command string and documents its accepted misses in its header; the real boundary is elsewhere (OS permissions for `.repos/**`, CI for changesets, the tree state for dogfood links). An over-deny is the expensive failure because it teaches agents to route around hooks, so guards deny only what is syntactically verifiable and fail open on ambiguity.
- **No bypass flags.** A guard that advertises an env-var escape hatch teaches agents to disarm safety mechanisms; a wrong deny is corrected at the source (a journal append, a tool call), never by a flag. See [plugin-changesets.md](./plugin-changesets.md#no-hook-blocks-on-changesets) for the case that set the rule.
- **Testing.** Every hook, monitor and skill script has a bats suite under `tests/` with PreToolUse/PostToolUse fixtures under `hooks/fixtures/`; `pnpm test:hooks` runs shellcheck then bats.

## Rationale

Hooks run as short-lived `bash` subprocesses with no shared state, so everything they need in common — envelope parsing, output shapes, env propagation, tree resolution — has to live in a sourced lib rather than be re-derived per script. Centralizing it means a fix to any of those concerns happens once, and the tripwire/no-bypass posture is a plugin-wide rule rather than a per-hook choice: the real boundaries live elsewhere, so a hook's job is to teach the sanctioned path early, not to be the last line of defense.
