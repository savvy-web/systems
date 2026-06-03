---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-06-02
last-synced: 2026-06-02
completeness: 88
related:
  - ./architecture.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
  - ../docs/architecture.md
dependencies: []
---

# plugins/silk — merged Claude Code plugin

The `silk@savvy-web-systems` Claude Code plugin. Merges the skills, agent and hooks of the three
source plugins (changesets, commitlint, lint-staged) into one, repointed at the unified `savvy` bin.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Skill Naming Scheme](#skill-naming-scheme)
- [MCP Orientation and the docs-search Skill](#mcp-orientation-and-the-docs-search-skill)
- [Hook Merge](#hook-merge)
- [Rationale](#rationale)

## Overview

`plugins/silk` is the companion plugin for `@savvy-web/silk`. It is **authored and bundled** in this
monorepo (plugins are static, not runtime-discovered) and registered as a **local** entry in
`.claude-plugin/marketplace.json` (`source: "./plugins/silk"`). The pre-existing git-subdir
marketplace entries for the three source plugins stay live until sub-project 3 deprecation.

**Location:** `plugins/silk` in `savvy-web/systems`
**Marketplace name:** `silk@savvy-web-systems`

## Current State

Implemented. Contents:

- **Skills** (`plugins/silk/skills/`): the merged set — tool-prefixed user-facing skills plus
  unprefixed internal mechanics. See the directory listing for the authoritative set.
- **Agent** (`plugins/silk/agents/changeset-manager.md`): carried over from the changesets plugin; it
  is the only caller of the unprefixed internal skills. Its `Bash` tool grants were normalized to the
  canonical space-glob form `Bash(git *)` (was the under-granting colon form `Bash(git:*)`).
- **Hooks** (`plugins/silk/hooks/`): all three source hook sets merged into one `hooks.json` plus
  per-event script dirs (`session-start`, `pre-tool-use`, `post-tool-use`, `user-prompt-submit`)
  and a shared `lib/`.
- **MCP wiring** (sub-project 2): an `mcpServers` block in `.claude-plugin/plugin.json` spawns the
  shared `savvy-mcp` server via `bin/start-mcp.sh`, the always-on `session-start/orientation.sh` hook
  directs the agent to the corpus, and a model-invocable `docs-search` skill carries detailed
  query technique. This is the "direction" half of the information-vs-direction split — see
  `../mcp/architecture.md`, and [MCP Orientation and the docs-search Skill](#mcp-orientation-and-the-docs-search-skill)
  below. The sibling `plugins/github-actions` reuses the identical launcher and server declaration;
  the separate `plugins/docs` plugin owns the corpus *write* side — see `../docs/architecture.md`.

## Skill Naming Scheme

The naming scheme is the load-bearing convention; the exact skill list is discoverable in the
`skills/` directory.

- **User-facing skills are tool-prefixed.** The changesets user skills became `changeset-create`,
  `changeset-check`, `changeset-list`, `changeset-preview`, `changeset-squash`, `changeset-style`
  (auto-loads on `.changeset/*.md`); the commitlint user skill `commit-create` already fit the
  scheme. Prefixing disambiguates now that three tools share one plugin.
- **Internal mechanics stay unprefixed.** `config`, `dependencies`, `update`, `merge`, `delete`,
  `status` are not user-invoked — only the `changeset-manager` agent calls them by name, so they
  keep their short names.

## MCP Orientation and the docs-search Skill

The silk plugin owns the **read** side of the corpus direction, split across two tiers by context cost.

**Tier 1 — the always-on nudge.** The combined `hooks/session-start/orientation.sh` hook (see [Hook Merge](#hook-merge)) emits the MCP nudge as part of its `cc-nudge-hooks` tier structure: an `<EXTREMELY_IMPORTANT>` (TIER 1) block requiring the agent to read `silk://catalog` before guessing a path and to use `silk_docs_search` before any filesystem grep for a convention/API/standards question, plus an `<important>` (TIER 2) block making `workspace_info` the default for workspace facts with a short labeled exception list (git status/branch, task-specific scripts, tool unavailable). The nudge points at the `docs-search` skill for detail but never inlines query syntax, keeping the always-on payload small. The hook has no matcher, so it fires on every start including resume/compact.

**Tier 2 — the on-demand skill.** `skills/docs-search/SKILL.md` is a **model-invocable** skill (`disable-model-invocation: false`) carrying corpus query best-practices: read the catalog first, phrase searches as concepts not filenames, interpret ranked results, and narrow when generated `api/*` pages dominate. It loads only when an agent is actually querying docs, so the detailed guidance costs context on demand rather than on every session start. It lives in silk (every silk consumer benefits from the read side) rather than the docs plugin (authoring only), and is the documented home for the post-0.1.0 `silk_docs_search` include/exclude filters.

This two-tier read split, plus the separate `plugins/docs` write plugin, is one coherent three-tier query/authoring scheme — see `../docs/architecture.md` for the full picture.

## Hook Merge

All source hook sets merge into `plugins/silk/hooks/hooks.json`. PreToolUse/PostToolUse matchers combine across the changesets push-guard and the commitlint bash/fs/mcp guards. Every hook script is **repointed** from the legacy `savvy-changesets …` / `savvy-commit …` bins to the unified `savvy changeset …` / `savvy commit hook …` paths; the shared resolver in `hooks/lib/` targets the single `savvy` bin.

The open hygiene concern (carried from the spec) is avoiding double-fires where the changesets and commitlint guards both match `Bash` — check `hooks.json`'s matcher set when adding a new Bash guard.

The same repoint applies to the **skill scripts**: the bundled scripts that shell out to the CLI (`changeset-check`'s `check.sh`/`lint.sh`, `config`'s `analyze-branch.sh`/`inspect.sh`, `dependencies`' `detect.sh`/`regen.sh`) target the unified `savvy changeset …` subcommands rather than the retired `savvy-changesets` standalone bin. Notably `changeset-check` validates via `savvy changeset lint` (the renamed CSH001–CSH005 entry point), not a `check` subcommand. Any plugin caller — hook or skill — that invokes the CLI goes through the single `savvy` bin; no script may assume a per-tool `savvy-*` bin is installed.

### SessionStart: two hooks, split by responsibility

The four former SessionStart hooks (artifacts of merging the changesets, commitlint and lint-staged plugins plus MCP orientation — `changeset-env-export.sh`, `mcp-orientation.sh`, `commit-main.sh`, `lint-staged-env.sh`) consolidated into two, registered as two entries in `hooks.json` and split by *when* they fire and *what side effect* they own:

- `session-start/orientation.sh` — **no matcher**, so it fires on every start including resume and compact. It is the env **producer**: it detects the package manager, writes the five session vars and dedup-appends them to `$CLAUDE_ENV_FILE` (see the namespace note below). It also emits the combined always-on orientation nudge — TIER-1 MCP catalog-first / `silk_docs_search` directive, TIER-2 `workspace_info` preference, the `<changesets_plugin>` tools/skills context, and the TIER-3 dogfood-feedback prompt.
- `session-start/startup-only.sh` — **`matcher: "startup"`**, so it fires only on a fresh start, not resume or compact. It runs the `savvy commit hook session-start` side effect (stdout redirected so it cannot pollute the hook JSON) and emits a brief Silk-system intro plus the code-quality startup orientation. (Design-doc-agent orientation is owned by the design-docs plugin, so silk intentionally does not duplicate it.) Because a SessionStart hook cannot block, its missing-`CLAUDE_PROJECT_DIR` guard emits a noop and exits 0 rather than failing the session.

### Session env namespace: `SILK_*`

The producer writes `SILK_PROJECT_DIR`, `SILK_DATA_DIR`, `SILK_PLUGIN_ROOT`, `SILK_SESSION_ID` and `SILK_PACKAGE_MANAGER` to a per-session `silk-hook.sh` file under `~/.claude/session-env/${session_id}/`. The lateral-propagation helper `hooks/lib/source-session-env.sh` sources every `*hook*.sh` in that dir, so consumer hooks (the push-guard, the changeset-validate post-tool hook) and the changeset skill scripts pick the vars up by their `SILK_*` names. The user-facing push-guard escape hatch is `SILK_SKIP_PUSH_CHECK` and the debug toggle sourced from `hooks/lib/hook-debug.sh` is `SILK_HOOK_DEBUG`. This `SILK_*` namespace replaced the merge-era `CHANGESETS_*` names across producers, consumers and skill scripts.

### Canonical lib, no per-plugin duplicates

The merge-era duplicates `hooks/lib/changesets-hook-output.sh` and `changesets-hook-debug.sh` were deleted; every hook now sources the canonical `hooks/lib/hook-output.sh` and `hook-debug.sh`.

### Dogfood-feedback prompt

The always-on orientation nudge tells the main agent to note rough edges in any silk skill, hook, the `savvy` CLI or the `changeset-manager` agent during the session, and to ask subagents it dispatches to report theirs back. At session end the agent surfaces what it noticed and asks the user before opening an issue in `savvy-web/systems` via `gh issue create` — a hard user-agreement gate: it must never file one on its own judgement.

## Rationale

### Why one plugin, prefixed skills

In practice the three tools are installed and configured as a unit, and a consumer wants one plugin,
not three. Merging them removes per-plugin ceremony. Tool-prefixing the user-facing skills is what
makes a single merged skill namespace legible; the agent-only mechanics stay unprefixed because no
human types them.

### Why repoint hooks at savvy

The whole point of sub-project 1 is one bin. Hooks that still shelled out to `savvy-changesets` /
`savvy-commit` would defeat the merge and require the old packages installed. Repointing them at
`savvy changeset …` / `savvy commit hook …` makes the plugin self-consistent with the merged CLI.
