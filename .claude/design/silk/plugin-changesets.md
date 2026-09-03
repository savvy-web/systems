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
  - ./plugin-commit-messages.md
  - ../mcp/architecture.md
  - ../silk-effects/architecture.md
dependencies: []
---

# plugins/silk — changeset capability

The changeset surface of the [silk plugin](./plugin.md): one flag-driven router skill, the `changeset-manager` agent with its internal skills over the `savvy-mcp` changeset tools, a PostToolUse validator and a Stop-time nudge that deliberately never blocks.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The router](#the-router)
- [The agent and its internal skills](#the-agent-and-its-internal-skills)
- [Validation hook](#validation-hook)
- [No hook blocks on changesets](#no-hook-blocks-on-changesets)
- [Rationale](#rationale)

## Overview

The pieces: `skills/changeset/` (the router) with `changeset-style` and `changeset-config` beside it, `agents/changeset-manager.md` and its unprefixed internal skills, `hooks/post-tool-use/changeset-validate-changeset.sh` and `hooks/stop/changeset-nudge.sh`. All mutation and inspection goes through the `savvy-mcp` changeset tools; only file validation and `--list` shell out.

## Current State

Implemented. The router's dispatch table, the agent's tool grants and the two hooks are as described below; `skills/changeset/SKILL.md` and `agents/changeset-manager.md` are authoritative for modes and grants.

## The router

`skills/changeset/SKILL.md` is the single user surface: `/silk:changeset --create|--squash|--list|--preview|--check`. The router parses the leading flag and dispatches; everything after it passes through verbatim. A bare or vague invocation defaults to create/reconcile, and a phrase table maps auto-triggered wording to a mode. The dispatch table in the skill is authoritative:

- `--create` / `--squash` → the `changeset-manager` agent (`subagent_type: silk:changeset-manager`).
- `--check` → the `changeset_validate` MCP tool directly (typed CSH001–CSH005 diagnostics).
- `--preview` → the `changeset_preview` MCP tool directly, which runs the genuine changesets engine and returns version bumps plus rendered CHANGELOG blocks. There is no hand-rolled merge step.
- `--list` → the bundled `scripts/list.sh`, which shells out to the project's own `@changesets/cli` (`changeset status --output`) for structured JSON — the one skill script that targets a CLI other than `savvy`.

The router's `allowed-tools` is **scoped** to what its own modes fire directly; the heavier `changeset_inspect` and `changeset_deps_*` grants live on the agent it dispatches to.

Two changeset skills stay outside the router because they cover file formats, not commands: `changeset-style` owns `.changeset/*.md` body format and `changeset-config` owns `.changeset/config.json` (including the Silk-custom `versionFiles` and `additionalScopes` fields). Both auto-load on their paths.

## The agent and its internal skills

`agents/changeset-manager.md` is the only caller of the unprefixed internal skills (`config`, `dependencies`, `update`, `merge`, `delete`, `status`). Its `tools:` allowlist carries every changeset MCP grant — `changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_regen`, `changeset_deps_detect` — plus `Bash(bash *)` so it can run the router's `list.sh` during inventory.

- **`config`** (`user-invocable: false`) is the agent's window onto changeset attribution: it calls `changeset_inspect` with `mode: "branch"` as the primary create-mode classification and `mode: "config"` for the resolved config view (`mode: "classify"` resolves one path to its owning package). The agent reads the tool's `structuredContent`.
- **`dependencies`** calls `changeset_deps_detect`/`changeset_deps_regen` directly; its "when to invoke" check reads the same `mode: "branch"` result. Both tools are thin adapters over silk-effects' `Changesets.DepsRegen` — see `../mcp/architecture.md` and `../silk-effects/architecture.md`.

## Validation hook

`hooks/post-tool-use/changeset-validate-changeset.sh` (`matcher: "Write|Edit"`) runs `savvy changeset validate-file` on any `.changeset/*.md` the agent writes and emits findings as `additionalContext`. It never blocks the tool call. The package-manager runner comes from the `SILK_PACKAGE_MANAGER` session var (see [plugin-hooks.md](./plugin-hooks.md#session-env-namespace)).

## No hook blocks on changesets

Whether a change needs a changeset is a **human judgement**, and no plugin hook makes it. A hook can only see "commits exist, no `.changeset/*.md`", which cannot distinguish a user-facing fix from a docs-only branch, so any hook that blocks on that signal is wrong for a large legitimate class of branches. A push-time guard that did block was removed rather than repaired: it resolved its tree from `CLAUDE_PROJECT_DIR` (so its verdict depended on the caller's cwd, not the ref being pushed) and its deny message advertised an env-var bypass, which taught agents to disarm a safety mechanism. That case is the origin of the plugin-wide no-bypass rule.

What stands instead:

- **`hooks/stop/changeset-nudge.sh`** (Stop) emits a top-level `systemMessage` — shown to the **user**, not injected into the model's context — when the branch has commits and no changeset. No `decision`, no `additionalContext`: it cannot block and does not ask the agent to act. `Stop` fires only for the main agent, so a subagent making many commits is never nagged, and it is debounced on HEAD so it speaks once per commit state. `SILK_SKIP_CHANGESET_NUDGE` silences it.
- **CI on the pull request** is where enforcement lives: the full branch diff exists there and an override is an explicit, reviewable human act.

Commit time is deliberately not a nudge point either — the changeset decision needs the whole branch diff, which does not exist at commit 3 of 12.

## Rationale

### Why MCP tools, not the CLI

The CLI's `--json` output is prefixed with an `Effect.log` line that breaks a naive `JSON.parse` of stdout; the structured MCP result has no such framing. Errors surface as MCP tool errors rather than exit codes and stderr, and there is no "CLI not installed" branch because the server ships the implementation. The CLI's inspection commands were removed; `changeset_inspect`/`changeset_validate`/`changeset_preview` are the inspection surface, and the CLI keeps the commands the hooks and release flow need (`lint`, `validate-file`, `check`, `transform`, `version`, `config validate`, `deps`). See `../mcp/architecture.md` for the tool half.

### Why a router instead of per-command skills

One flag-driven skill keeps a single entry point in the `/silk:*` namespace and lets a bare or vague invocation default to the common case, while the two format skills stay separate because they auto-load on file paths, not on intent.
