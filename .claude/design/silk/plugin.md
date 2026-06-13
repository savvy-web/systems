---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-06-12
last-synced: 2026-06-12
completeness: 88
related:
  - ./architecture.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
  - ../docs/architecture.md
dependencies: []
---

# plugins/silk — merged Claude Code plugin

The `silk@savvy-web-systems` Claude Code plugin. Merges the skills, agents and hooks of the three source plugins (changesets, commitlint, lint-staged) into one, repointed at the unified `savvy` bin, and adds a read-only Turborepo capability (the `turbo` skill and `turborepo` agent) and a Biome capability (LSP plus the `biome_check` MCP tool) over the shared `savvy-mcp` server.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Skill naming scheme](#skill-naming-scheme)
- [MCP orientation and the docs-search skill](#mcp-orientation-and-the-docs-search-skill)
- [Turborepo capability](#turborepo-capability)
- [Biome capability](#biome-capability)
- [The config skill drives changeset_inspect](#the-config-skill-drives-changeset_inspect)
- [Hook merge](#hook-merge)
- [Rationale](#rationale)

## Overview

`plugins/silk` is the companion plugin for `@savvy-web/silk`. It is **authored and bundled** in this monorepo (plugins are static, not runtime-discovered) and registered as a **local** entry in `.claude-plugin/marketplace.json` (`source: "./plugins/silk"`).

**Location:** `plugins/silk` in `savvy-web/systems`
**Marketplace name:** `silk@savvy-web-systems`

## Current State

Implemented. Contents:

- **Skills** (`plugins/silk/skills/`): the merged set — tool-prefixed user-facing skills plus unprefixed internal mechanics. See the directory listing for the authoritative set and [Skill naming scheme](#skill-naming-scheme).
- **Agents** (`plugins/silk/agents/`): `changeset-manager.md`, the only caller of the unprefixed internal skills; and `turborepo.md`, the Turborepo domain agent that drives the MCP `turbo_inspect` tool for multi-step cache diagnosis, `turbo.json` refactors and CI cache setup. See [Turborepo capability](#turborepo-capability).
- **Turbo skill** (`plugins/silk/skills/turbo/`): the model-invocable `turbo` front-door skill plus bundled `references/`. See [Turborepo capability](#turborepo-capability).
- **Hooks** (`plugins/silk/hooks/`): all three source hook sets merged into one `hooks.json` plus per-event script dirs and a shared `lib/`. See [Hook merge](#hook-merge).
- **MCP wiring**: an `mcpServers` block in `.claude-plugin/plugin.json` spawns the shared `savvy-mcp` server via `bin/start-mcp.sh`, the always-on `session-start/orientation.sh` hook directs the agent to the corpus, and a model-invocable `docs-search` skill carries detailed query technique. This is the "direction" half of the information-vs-direction split — see `../mcp/architecture.md` and [MCP orientation and the docs-search skill](#mcp-orientation-and-the-docs-search-skill). The sibling `plugins/github-actions` reuses the identical launcher and server declaration; the separate `plugins/docs` plugin owns the corpus *write* side — see `../docs/architecture.md`.
- **Biome LSP wiring**: an `lspServers.biome` block in `.claude-plugin/plugin.json` (sibling to `mcpServers`) launches `biome lsp-proxy` via `bin/biome-lsp.sh`, surfacing automatic Biome lint/format diagnostics after edits. See [Biome capability](#biome-capability).

## Skill naming scheme

The naming scheme is the load-bearing convention; the exact skill list is discoverable in the `skills/` directory.

- **User-facing skills are tool-prefixed** (`changeset-*`, `commit-create`). Prefixing disambiguates now that three tools share one plugin.
- **Internal mechanics stay unprefixed** (`config`, `dependencies`, `update`, `merge`, `delete`, `status`). They are not user-invoked — only the `changeset-manager` agent calls them by name, so they keep their short names.

## MCP orientation and the docs-search skill

The silk plugin owns the **read** side of the corpus direction, split across two tiers by context cost.

**Tier 1 — the always-on nudge.** The combined `hooks/session-start/orientation.sh` hook (see [Hook merge](#hook-merge)) emits the MCP nudge as part of its tier structure: an `<EXTREMELY_IMPORTANT>` (tier 1) block requiring the agent to read `silk://catalog` before guessing a path and to use `silk_docs_search` before any filesystem grep for a convention/API/standards question, plus an `<important>` (tier 2) block making `workspace_info` the default for workspace facts with a short labeled exception list. The nudge points at the `docs-search` skill for detail but never inlines query syntax, keeping the always-on payload small. The hook has no matcher, so it fires on every start including resume/compact.

**Tier 2 — the on-demand skill.** `skills/docs-search/SKILL.md` is a **model-invocable** skill carrying corpus query best-practices: read the catalog first, phrase searches as concepts not filenames, interpret ranked results, and narrow when generated `api/*` pages dominate. It loads only when an agent is actually querying docs, so the detailed guidance costs context on demand rather than on every session start. It lives in silk (every silk consumer benefits from the read side) rather than the docs plugin (authoring only), and is the documented home for the `silk_docs_search` include/exclude filters.

This two-tier read split, plus the separate `plugins/docs` write plugin, is one coherent three-tier query/authoring scheme — see `../docs/architecture.md` for the full picture.

## Turborepo capability

The plugin layers a read-only Turborepo capability over the shared `savvy-mcp` server's `turbo_inspect` tool (see `../mcp/architecture.md`), structured the same way as the docs-search read side — a light always-on nudge, an on-demand skill, and a domain agent for heavy work.

- **The `<turbo_capability>` orientation block.** `hooks/session-start/orientation.sh` advertises `turbo_inspect`'s three modes (`cache`/`graph`/`affected`) and points lighter questions at the `turbo` skill (`/silk:turbo`) and heavier multi-step work at the `turborepo` agent. A `<note>` in the active-hooks block records that `turbo_inspect` has **no** hook — it is a read-only MCP tool the agent calls directly.
- **The `turbo` skill** (`skills/turbo/SKILL.md`) is the model-invocable front door: decision trees, an anti-pattern catalog with rationale, and bundled `references/` deep dives. It encodes the Silk install/build-decoupling and api-docs turbo ordering so recommendations respect the monorepo's CI order.
- **The `turborepo` agent** (`agents/turborepo.md`) is the autonomous specialist for heavier work, operating in three modes (cache diagnosis / graph refactor / affected-CI). Its contract is *diagnose first, recommend second*: it pulls actual hash contributors and graph edges via `turbo_inspect` and only edits `turbo.json` once it can cite the contributor that justifies the change. It preloads the `turbo` skill.
- **Safe-bash allowlist.** `hooks/lib/safe-bash-patterns.txt` auto-allows read-only `turbo … --dry`/`--dry=json` runs. The bare `turbo run <task>` form (which executes the task and mutates the cache) is intentionally **not** allowlisted — the load-bearing safety line that keeps the capability read-only at the bash layer too.

## Biome capability

The plugin gives the agent three channels onto Biome — the suite's linter/formatter — each suited to a different intent: automatic in-loop feedback (LSP), on-demand structured execution with fixes (the MCP tool), and a raw escape hatch (Bash). The plugin only wires the connections; both the LSP and the MCP proxy require Biome on `PATH` (the suite uses a global Biome, matching the VS Code extension) — neither bundles the binary.

- **The Biome LSP — automatic diagnostics.** An `lspServers.biome` block in `.claude-plugin/plugin.json` (same shape as the `mcpServers` block) launches Biome's language server so lint/format diagnostics on the file the agent just edited land in context with zero prompting. The `command` is `sh` running `bin/biome-lsp.sh`. The `extensionToLanguage` map covers the suite's source extensions but deliberately omits html (the suite has none); see the `lspServers.biome` block in `plugin.json` for the authoritative list. The LSP is diagnostics-only: it sees only open/edited files (not a whole-repo scan) and **cannot apply fixes** — fixing is the MCP tool's or Bash's job.
- **`bin/biome-lsp.sh` — the resolver.** A POSIX `sh` wrapper (skeleton of `bin/start-mcp.sh`, `set -eu`, `exec`s the final process) so a consumer without a global Biome gets an actionable error instead of a bare `Executable not found in $PATH`. Resolution order matches `Lint.Biome`'s own discovery: global `biome` on `PATH` first, then a walk-up for project-local `node_modules/.bin/biome`, then a clear stderr message and a non-zero exit.
- **`biome_check` MCP tool — structured execution with fixes.** The shared `savvy-mcp` server exposes a `biome_check` tool that runs Biome over a path and returns parsed diagnostics, supporting read-only check plus safe (`write`) and unsafe (`unsafe`) fixes. This is the "I want a structured result or want to apply fixes" channel the LSP cannot provide. See `../mcp/architecture.md` for the tool (it is the first mutating savvy-mcp tool, an intentional read-only-convention exception).
- **The `biome-prefer-mcp` PreToolUse hook — nudge, never block.** `hooks/pre-tool-use/biome-prefer-mcp.sh` (a third `matcher: "Bash"` PreToolUse entry in `hooks.json`) detects when the agent runs Biome through Bash — either directly or indirectly via a package-manager/turbo script whose nearest `package.json` body mentions `biome` — and emits a one-time-per-session `additionalContext` nudge toward `biome_check`. It is **purely additive**: it emits **no** `permissionDecision`, so the command always proceeds and Bash Biome stays a valid escape hatch. The once-per-session marker keys on the envelope `session_id` under `~/.claude/session-env/`, falling back to a fixed `_no-session` key when no session id is present. It fails open without `jq` and is best-effort on the indirect case (only the nearest root `package.json` is consulted). The MCP proxy and the LSP both run Biome in their own processes (not the Bash tool), so neither self-triggers the hook.
- **The `<biome_capability>` orientation block.** `hooks/session-start/orientation.sh` carries a moderate-tier block (not `EXTREMELY_IMPORTANT`) teaching the division of labor: the LSP shows problems automatically but cannot fix; `biome_check` checks or fixes any path with a structured result; Bash Biome is the raw escape hatch. It records the `biome-prefer-mcp` hook so the agent knows a Bash Biome call draws a one-time nudge, not a block.

## The config skill drives changeset_inspect

The `config` skill (`skills/config/SKILL.md`, agent-internal, `user-invocable: false`) is the `changeset-manager` agent's window onto changeset attribution. It calls the shared `savvy-mcp` server's `changeset_inspect` MCP tool directly (`allowed-tools: mcp__savvy-mcp__changeset_inspect`), with `mode: "branch"` as the primary create-mode classification call and `mode: "config"` as the secondary config-only view. The `changeset-manager` agent holds the same tool grant and reads the tool's `structuredContent` (the `BranchAnalysis` / `InspectedConfig` shapes); the `dependencies` skill's "when to invoke" check reads the same `mode: "branch"` result. See `../mcp/architecture.md` for the tool half.

The load-bearing reason it uses the MCP tool rather than the CLI: the CLI's `--json` output is prefixed with an `Effect.log` `[…] INFO (#NN):` line that breaks a naive `JSON.parse` of stdout. The structured MCP result has no such framing, removing the stdout-parsing fragility. Error handling also simplifies — the tool surfaces `ConfigurationError` / `GitError` as MCP tool errors (no exit codes, no stderr to parse), and there is no "CLI not installed" branch because the MCP server ships the implementation. The `savvy changeset analyze-branch` / `config show` CLI commands are retained for direct human/script use.

## Hook merge

All source hook sets merge into `plugins/silk/hooks/hooks.json`. PreToolUse/PostToolUse matchers combine across the changesets push-guard and the commitlint bash/fs/mcp guards, plus the Biome `biome-prefer-mcp.sh` nudge as a third `matcher: "Bash"` PreToolUse entry (see [Biome capability](#biome-capability)). Every hook script targets the unified `savvy changeset …` / `savvy commit hook …` paths; the shared resolver in `hooks/lib/` targets the single `savvy` bin.

A standing hygiene concern is avoiding double-fires where the changesets and commitlint guards both match `Bash` — check `hooks.json`'s matcher set when adding a new Bash guard.

The same applies to the **skill scripts**: the bundled scripts that shell out to the CLI (`changeset-check`'s `check.sh`/`lint.sh`, `dependencies`' `detect.sh`/`regen.sh`) target the unified `savvy changeset …` subcommands. Notably `changeset-check` validates via `savvy changeset lint`, not a `check` subcommand. Any plugin caller — hook or skill — that invokes the CLI goes through the single `savvy` bin; no script may assume a per-tool `savvy-*` bin is installed.

The `config` skill is the exception: it does not shell out at all, calling the `changeset_inspect` MCP tool directly — see [The config skill drives changeset_inspect](#the-config-skill-drives-changeset_inspect).

### SessionStart: two hooks, split by responsibility

Two SessionStart hooks are registered as two entries in `hooks.json`, split by *when* they fire and *what side effect* they own:

- `session-start/orientation.sh` — **no matcher**, so it fires on every start including resume and compact. It is the env **producer**: it detects the package manager, writes the session vars and dedup-appends them to `$CLAUDE_ENV_FILE` (see the namespace note below). It also emits the combined always-on orientation nudge — tier-1 MCP catalog-first / `silk_docs_search` directive, tier-2 `workspace_info` preference, the `<turbo_capability>` block (see [Turborepo capability](#turborepo-capability)), the `<biome_capability>` block (see [Biome capability](#biome-capability)), the `<changesets_plugin>` tools/skills context, and the tier-3 dogfood-feedback prompt.
- `session-start/startup-only.sh` — **`matcher: "startup"`**, so it fires only on a fresh start, not resume or compact. It runs the `savvy commit hook session-start` side effect (stdout redirected so it cannot pollute the hook JSON) and emits a brief Silk-system intro plus the code-quality startup orientation. (Design-doc-agent orientation is owned by the design-docs plugin, so silk intentionally does not duplicate it.) Because a SessionStart hook cannot block, its missing-`CLAUDE_PROJECT_DIR` guard emits a noop and exits 0 rather than failing the session.

### Session env namespace: `SILK_*`

The producer writes the `SILK_*` session vars (project dir, data dir, plugin root, session id, package manager) to a per-session `silk-hook.sh` file under `~/.claude/session-env/${session_id}/`. The lateral-propagation helper `hooks/lib/source-session-env.sh` sources every `*hook*.sh` in that dir, so consumer hooks (the push-guard, the changeset-validate post-tool hook) and the changeset skill scripts pick the vars up by their `SILK_*` names. The user-facing push-guard escape hatch is `SILK_SKIP_PUSH_CHECK` and the debug toggle sourced from `hooks/lib/hook-debug.sh` is `SILK_HOOK_DEBUG`.

### Canonical lib, no per-plugin duplicates

Every hook sources the canonical `hooks/lib/hook-output.sh` and `hook-debug.sh`; there are no per-tool duplicates of these libs.

### Dogfood-feedback prompt

The always-on orientation nudge tells the main agent to note rough edges in any silk skill, hook, the `savvy` CLI or the `changeset-manager` agent during the session, and to ask subagents it dispatches to report theirs back. At session end the agent surfaces what it noticed and asks the user before opening an issue in `savvy-web/systems` via `gh issue create` — a hard user-agreement gate: it must never file one on its own judgement.

## Rationale

### Why one plugin, prefixed skills

In practice the three tools are installed and configured as a unit, and a consumer wants one plugin, not three. Merging them removes per-plugin ceremony. Tool-prefixing the user-facing skills is what makes a single merged skill namespace legible; the agent-only mechanics stay unprefixed because no human types them.

### Why hooks target the single savvy bin

The point of the merge is one bin. Hooks that still shelled out to per-tool `savvy-changesets` / `savvy-commit` bins would defeat the merge and require the old packages installed. Targeting `savvy changeset …` / `savvy commit hook …` makes the plugin self-consistent with the merged CLI.
