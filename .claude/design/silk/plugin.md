---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-07-07
last-synced: 2026-07-07
completeness: 88
related:
  - ./architecture.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
dependencies: []
---

# plugins/silk — merged Claude Code plugin

The `silk@savvy-web-systems` Claude Code plugin. Merges the skills, agents and hooks of the three source plugins (changesets, commitlint, lint-staged) into one, repointed at the unified `savvy` bin, and adds a read-only Turborepo capability (the `turbo` skill and `turborepo` agent) and a Biome capability (LSP plus the `biome_check` MCP tool) over the shared `savvy-mcp` server.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Skill naming scheme](#skill-naming-scheme)
- [MCP tool orientation](#mcp-tool-orientation)
- [Turborepo capability](#turborepo-capability)
- [Biome capability](#biome-capability)
- [TSDoc capability](#tsdoc-capability)
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
- **Agents** (`plugins/silk/agents/`): `changeset-manager.md`, the only caller of the unprefixed internal skills; `turborepo.md`, the Turborepo domain agent that drives the MCP `turbo_inspect` tool for multi-step cache diagnosis, `turbo.json` refactors and CI cache setup; and `tsdoctor.md`, the TSDoc agent that drives a package's `ae-*`/`tsdoc-*` diagnostics to zero off the build's `issues.json` artifact. See [Turborepo capability](#turborepo-capability) and [TSDoc capability](#tsdoc-capability).
- **Turbo skill** (`plugins/silk/skills/turbo/`): the model-invocable `turbo` front-door skill, self-contained via bundled `references/` — the six Turborepo standards that used to be served from the mcp corpus now live there. See [Turborepo capability](#turborepo-capability).
- **TSDoc capability** (`plugins/silk/skills/tsdoc/`, `agents/tsdoctor.md`, `plugins/silk/monitors/`): the skill, the `tsdoctor` agent and a background monitor over the build's `issues.json` artifact. See [TSDoc capability](#tsdoc-capability).
- **Hooks** (`plugins/silk/hooks/`): all three source hook sets merged into one `hooks.json` plus per-event script dirs and a shared `lib/`. See [Hook merge](#hook-merge).
- **MCP wiring**: an `mcpServers` block in `.claude-plugin/plugin.json` spawns the shared `savvy-mcp` server via `bin/start-mcp.sh`, and the always-on `session-start/orientation.sh` hook orients the agent toward the server's tools. This is the "direction" half of the information-vs-direction split — see `../mcp/architecture.md` and [MCP tool orientation](#mcp-tool-orientation). The sibling `plugins/github-actions` reuses the identical launcher and server declaration.
- **Biome LSP wiring**: an `lspServers.biome` block in `.claude-plugin/plugin.json` (sibling to `mcpServers`) launches `biome lsp-proxy` via `bin/biome-lsp.sh`, surfacing automatic Biome lint/format diagnostics after edits. See [Biome capability](#biome-capability).

## Skill naming scheme

The naming scheme is the load-bearing convention; the exact skill list is discoverable in the `skills/` directory.

- **User-facing skills are tool-prefixed** (`changeset-*`, `commit-create`). Prefixing disambiguates now that three tools share one plugin.
- **Internal mechanics stay unprefixed** (`config`, `dependencies`, `update`, `merge`, `delete`, `status`). They are not user-invoked — only the `changeset-manager` agent calls them by name, so they keep their short names.

## MCP tool orientation

The silk plugin spawns the shared `savvy-mcp` server (tools-only — see `../mcp/architecture.md`) and orients the agent toward its tools. The combined `hooks/session-start/orientation.sh` hook (see [Hook merge](#hook-merge)) emits an always-on nudge making `workspace_info` the default for workspace facts (with a short labeled exception list) and steering the agent toward the structured MCP tools — `changeset_inspect`/`changeset_validate`/`changeset_preview`, `turbo_inspect` and `biome_check` — over parsing bash stdout. The nudge stays small: per-capability detail lives in the on-demand `turbo`/`tsdoc` skills and the `<turbo_capability>`/`<biome_capability>` orientation blocks below. The hook has no matcher, so it fires on every start including resume/compact.

This is the "direction" half of the information-vs-direction split: information lives in the server, direction in the plugin.

## Turborepo capability

The plugin layers a read-only Turborepo capability over the shared `savvy-mcp` server's `turbo_inspect` tool (see `../mcp/architecture.md`), structured as a light always-on nudge, an on-demand skill and a domain agent for heavy work.

- **The `<turbo_capability>` orientation block.** `hooks/session-start/orientation.sh` advertises `turbo_inspect`'s three modes (`cache`/`graph`/`affected`) and points lighter questions at the `turbo` skill (`/silk:turbo`) and heavier multi-step work at the `turborepo` agent. A `<note>` in the active-hooks block records that `turbo_inspect` has **no** hook — it is a read-only MCP tool the agent calls directly.
- **The `turbo` skill** (`skills/turbo/SKILL.md`) is the model-invocable front door: decision trees, an anti-pattern catalog with rationale, and bundled `references/` deep dives (the six Turborepo standards previously served from the mcp corpus). It encodes the Silk install/build-decoupling turbo ordering so recommendations respect the monorepo's CI order.
- **The `turborepo` agent** (`agents/turborepo.md`) is the autonomous specialist for heavier work, operating in three modes (cache diagnosis / graph refactor / affected-CI). Its contract is *diagnose first, recommend second*: it pulls actual hash contributors and graph edges via `turbo_inspect` and only edits `turbo.json` once it can cite the contributor that justifies the change. It preloads the `turbo` skill.
- **Safe-bash allowlist.** `hooks/lib/safe-bash-patterns.txt` auto-allows read-only `turbo … --dry`/`--dry=json` runs. The bare `turbo run <task>` form (which executes the task and mutates the cache) is intentionally **not** allowlisted — the load-bearing safety line that keeps the capability read-only at the bash layer too.

## Biome capability

The plugin gives the agent three channels onto Biome — the suite's linter/formatter — each suited to a different intent: automatic in-loop feedback (LSP), on-demand structured execution with fixes (the MCP tool), and a raw escape hatch (Bash). The plugin only wires the connections; both the LSP and the MCP proxy require Biome on `PATH` (the suite uses a global Biome, matching the VS Code extension) — neither bundles the binary.

- **The Biome LSP — automatic diagnostics.** An `lspServers.biome` block in `.claude-plugin/plugin.json` (same shape as the `mcpServers` block) launches Biome's language server so lint/format diagnostics on the file the agent just edited land in context with zero prompting. The `command` is `sh` running `bin/biome-lsp.sh`. The `extensionToLanguage` map covers the suite's source extensions but deliberately omits html (the suite has none); see the `lspServers.biome` block in `plugin.json` for the authoritative list. The LSP is diagnostics-only: it sees only open/edited files (not a whole-repo scan) and **cannot apply fixes** — fixing is the MCP tool's or Bash's job.
- **`bin/biome-lsp.sh` — the resolver.** A POSIX `sh` wrapper (skeleton of `bin/start-mcp.sh`, `set -eu`, `exec`s the final process) so a consumer without a global Biome gets an actionable error instead of a bare `Executable not found in $PATH`. Resolution order matches `Lint.Biome`'s own discovery: global `biome` on `PATH` first, then a walk-up for project-local `node_modules/.bin/biome`, then a clear stderr message and a non-zero exit.
- **`biome_check` MCP tool — structured execution with fixes.** The shared `savvy-mcp` server exposes a `biome_check` tool that runs Biome over a path and returns parsed diagnostics, supporting read-only check plus safe (`write`) and unsafe (`unsafe`) fixes. This is the "I want a structured result or want to apply fixes" channel the LSP cannot provide. See `../mcp/architecture.md` for the tool (it is the first mutating savvy-mcp tool, an intentional read-only-convention exception).
- **The `biome-prefer-mcp` PreToolUse hook — nudge, never block.** `hooks/pre-tool-use/biome-prefer-mcp.sh` (a third `matcher: "Bash"` PreToolUse entry in `hooks.json`) detects when the agent runs Biome through Bash — either directly (Biome in *command position*) or indirectly via a package-manager/turbo script whose nearest `package.json` body mentions `biome` — and emits a one-time-per-session `additionalContext` nudge toward `biome_check`. It is **purely additive**: it emits **no** `permissionDecision`, so the command always proceeds and Bash Biome stays a valid escape hatch. The once-per-session marker keys on the envelope `session_id` under `~/.claude/session-env/`, falling back to a fixed `_no-session` key when no session id is present. It fails open without `jq` and is best-effort on the indirect case (only the nearest root `package.json` is consulted). The MCP proxy and the LSP both run Biome in their own processes (not the Bash tool), so neither self-triggers the hook. Two boundary rules keep the nudge from misfiring:
  - **Subagent suppression (savvy-web/systems#247).** The envelope carries `agent_id` only inside a dispatched subagent call, and subagents run with an explicit curated `tools:` allowlist — so a session-level "prefer `biome_check`" nudge is either redundant (the subagent already lists the tool) or a dead end (it lacks the tool, gets "No such tool available", falls back to Bash Biome and re-triggers the hook, a loop with no exit). The hook emits nothing when `agent_id` is present, and does so *before* touching the once-per-session marker so a subagent's Bash Biome call never consumes the main thread's one-time nudge. The main-session nudge (no `agent_id`, tool genuinely available) is unchanged.
  - **Command-position matching (savvy-web/systems#248).** Biome counts as invoked only when it is the first token of a control-operator-delimited segment (quote-aware, so an operator inside a quoted argument is not a false boundary; optionally path-prefixed, and after peeling a leading `env`, inline `VAR=value` assignments and/or a runner keyword like `npx`/`pnpm run`) — not when "biome" merely appears as a later argument or inside quoted prose (the `gh issue create --body "…biome…"` false-fire this fixes). It is deliberately not a full shell parser: command substitutions are not descended into, a false-negative-over-false-positive choice consistent with "a nudge, not a parser".
- **The `<biome_capability>` orientation block.** `hooks/session-start/orientation.sh` carries a moderate-tier block (not `EXTREMELY_IMPORTANT`) teaching the division of labor: the LSP shows problems automatically but cannot fix; `biome_check` checks or fixes any path with a structured result; Bash Biome is the raw escape hatch. It records the `biome-prefer-mcp` hook so the agent knows a Bash Biome call draws a one-time nudge, not a block.

## TSDoc capability

The plugin's TSDoc capability mirrors the Turborepo shape — a reference skill, a domain agent and an always-on surface — all built on the structured `dist/<target>/issues.json` artifact `@savvy-web/tsdown-plugins` emits (see `../tsdown-plugins/architecture.md`). It is the agent-facing half of the binary `@public`/`@internal` release-tag and API-Extractor-diagnostic policy that package enforces in code; the policy it teaches is the same one `runApiExtractor` routes and escalates (which fails CI on forgotten exports).

- **The `tsdoc` skill** (`skills/tsdoc/SKILL.md`) is the model-invocable authoring reference (`/silk:tsdoc`, also `paths`-triggered on `**/savvy.build.ts` and `**/dist/*/issues.json`) plus bundled `references/`. It teaches toolchain-correct TSDoc and the binary release-tag recipe. Its "Verify your work" step now reads `dist/prod/issues.json` (a `jq` filter on `ae-*`/`tsdoc-*` codes) rather than grepping build stdout — keying off the artifact's contract that a present-but-empty file means clean and an absent file means not-built.
- **The `tsdoctor` agent** (`agents/tsdoctor.md`) drives a package's diagnostics to zero end to end: build (prod, because `ae-*`/`tsdoc-*` come from the prod-only meta pass) → read `dist/prod/issues.json` → fix each `ae-*`/`tsdoc-*` per the skill's binary release-tag policy → rebuild to confirm clean. It preloads the `tsdoc` skill and edits only source TSDoc and the export/release-tag surface. Its load-bearing boundary: it **never adds `suppressWarnings` entries** — suppression is a human escape hatch — and it surfaces a genuine `@beta`/`@alpha` maturity call to the user rather than guessing.
- **The background monitor** (`monitors/monitors.json` + `monitors/watch-issues.mjs`) is a Node poller that surfaces `ae-*`/`tsdoc-*` counts from `dist/*/issues.json` as agent notifications. It is low-noise via **debounce** (savvy-web/systems#248): a non-zero count must hold unchanged across a short quiet period (`STABLE_POLLS`, default 3 polls at the 2s interval ≈ 6s, overridable via `SILK_TSDOC_MONITOR_STABLE_POLLS`) before it notifies. A build in progress keeps the count moving and resets the streak, so the churn an agent produces while actively fixing diagnostics — or a fresh package building from scratch — never fires; a genuinely stuck non-zero count still surfaces exactly once, and a return to zero clears the dedup so a later regression can fire again. `--once` mode reports immediately (no polling history to build a quiet period from). The notification tells the reader to let an in-flight build or fixing agent finish before dispatching another, rather than acting on the line immediately. The pure `diagnose` step is an exported function so tests can import it, and the run loop is guarded by a symlink-safe entry check (`realpathSync` comparison of `process.argv[1]` against the resolved module path) so a symlinked plugin root does not silently stop the monitor from starting. This is the plugin's first background monitor.
- **Why a monitor, not a hook.** A `FileChanged` hook was rejected: its matcher is literal-filename only (no glob across packages) and it injects no context, so it cannot tell the agent *which* package regressed. A background poller is the primitive that can both watch every package's artifact and emit an actionable notification naming the package and pointing at the `tsdoctor` agent / `/silk:tsdoc`.

## The config skill drives changeset_inspect

The `config` skill (`skills/config/SKILL.md`, agent-internal, `user-invocable: false`) is the `changeset-manager` agent's window onto changeset attribution. It calls the shared `savvy-mcp` server's `changeset_inspect` MCP tool directly (`allowed-tools: mcp__plugin_silk_savvy-mcp__changeset_inspect`), with `mode: "branch"` as the primary create-mode classification call and `mode: "config"` as the secondary config-only view (a third `mode: "classify"` resolves an arbitrary path to its owning package). The `changeset-manager` agent holds the same tool grant plus `mcp__plugin_silk_savvy-mcp__changeset_validate` (structured changeset-file validation), and reads the tool's `structuredContent` (the `BranchAnalysis` / `InspectedConfig` shapes); the `dependencies` skill's "when to invoke" check reads the same `mode: "branch"` result. See `../mcp/architecture.md` for the tool half.

The load-bearing reason it uses the MCP tool rather than the CLI: the CLI's `--json` output is prefixed with an `Effect.log` `[…] INFO (#NN):` line that breaks a naive `JSON.parse` of stdout. The structured MCP result has no such framing, removing the stdout-parsing fragility. Error handling also simplifies — the tool surfaces `ConfigurationError` / `GitError` as MCP tool errors (no exit codes, no stderr to parse), and there is no "CLI not installed" branch because the MCP server ships the implementation. The `savvy changeset analyze-branch` / `config show` / `classify` / `release-surface` inspection commands have been **removed** from the CLI; the `changeset_inspect` / `changeset_validate` MCP tools are the inspection surface. The CLI keeps only `lint` / `validate-file` (used by the bash PostToolUse hook) plus `check` / `transform` / `version` / `config validate` / `deps`.

The model-invocable `changeset-preview` skill (`skills/changeset-preview/SKILL.md`) is the read-only release-preview front door: it renders directly from the `changeset_preview` MCP tool (`allowed-tools: mcp__plugin_silk_savvy-mcp__changeset_preview`), which runs the genuine changesets engine and returns the version bumps plus rendered CHANGELOG blocks. The skill's previous hand-rolled multi-step CHANGELOG-merge algorithm is gone — it now presents the tool's structured result and markdown transcript, with the only caveat narrowed to the inherent commit-metadata gap. See `../mcp/architecture.md` for the tool.

## Hook merge

All source hook sets merge into `plugins/silk/hooks/hooks.json`. PreToolUse/PostToolUse matchers combine across the changesets push-guard and the commitlint bash/fs/mcp guards, plus the Biome `biome-prefer-mcp.sh` nudge as a third `matcher: "Bash"` PreToolUse entry (see [Biome capability](#biome-capability)). Every hook script targets the unified `savvy changeset …` / `savvy commit hook …` paths; the shared resolver in `hooks/lib/` targets the single `savvy` bin.

A standing hygiene concern is avoiding double-fires where the changesets and commitlint guards both match `Bash` — check `hooks.json`'s matcher set when adding a new Bash guard.

The same applies to the **skill scripts**: the bundled scripts that shell out to the CLI (`changeset-check`'s `check.sh`/`lint.sh`) target the unified `savvy changeset …` subcommands. Notably `changeset-check` validates via `savvy changeset lint`, not a `check` subcommand. Any plugin caller — hook or skill — that invokes the CLI goes through the single `savvy` bin; no script may assume a per-tool `savvy-*` bin is installed.

The `config` and `dependencies` skills are the exceptions: neither shells out — `config` calls the `changeset_inspect` MCP tool directly (see [The config skill drives changeset_inspect](#the-config-skill-drives-changeset_inspect)), and `dependencies` calls the `changeset_deps_regen`/`changeset_deps_detect` MCP tools directly (its former `detect.sh`/`regen.sh` scripts are retired). Both are thin adapters over `Changesets.DepsRegen` — see `../mcp/architecture.md` and `../silk-effects/architecture.md`.

### SessionStart: two hooks, split by responsibility

Two SessionStart hooks are registered as two entries in `hooks.json`, split by *when* they fire and *what side effect* they own:

- `session-start/orientation.sh` — **no matcher**, so it fires on every start including resume and compact. It is the env **producer**: it detects the package manager, writes the session vars and dedup-appends them to `$CLAUDE_ENV_FILE` (see the namespace note below). It also emits the combined always-on orientation nudge — the `workspace_info` preference and MCP tool orientation (see [MCP tool orientation](#mcp-tool-orientation)), the `<turbo_capability>` block (see [Turborepo capability](#turborepo-capability)), the `<biome_capability>` block (see [Biome capability](#biome-capability)), the `<changesets_plugin>` tools/skills context, and the dogfood-feedback prompt.
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
