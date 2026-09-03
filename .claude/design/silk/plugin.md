---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ./plugin-hooks.md
  - ./plugin-changesets.md
  - ./plugin-commit-messages.md
  - ./plugin-biome.md
  - ./plugin-turbo.md
  - ./plugin-build-tsdoc.md
  - ./plugin-repos.md
  - ./plugin-dogfood.md
  - ./plugin-it2.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
dependencies: []
---

# plugins/silk — the Claude Code plugin

The `silk@savvy-web-systems` Claude Code plugin: the companion to `@savvy-web/silk` ([architecture.md](./architecture.md)). It bundles the skills, agents, hooks and background monitors for every Silk capability behind the single `savvy` bin and the shared `savvy-mcp` server. This doc is the overview; each capability has its own doc, linked below.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Layout](#layout)
- [Capabilities](#capabilities)
- [Skill naming scheme](#skill-naming-scheme)
- [Server wiring](#server-wiring)
- [Rationale](#rationale)

## Overview

`plugins/silk` is **authored and bundled** in this monorepo (plugins are static, not runtime-discovered) and registered in `.claude-plugin/marketplace.json` under the marketplace name `savvy-web-systems`. It is the repo's only plugin. Its manifest version is bumped in lockstep with `@savvy-web/silk` via that package's `versionFiles` glob (see `../changelog/architecture.md` for the changesets wiring).

The organizing split it shares with the MCP server: **information lives in the server, direction lives in the plugin.** The server carries every tool regardless of project; the plugin decides which to surface, when to nudge and what to deny. See `../mcp/architecture.md`.

## Current State

Implemented and shipped with every `@savvy-web/silk` release. All nine capabilities listed under [Capabilities](#capabilities) are live; `plugins/silk/` is the authoritative inventory of skills, agents, hooks and monitors, and `pnpm test:hooks` covers the shell and monitor surface.

## Layout

- `.claude-plugin/plugin.json` — manifest, plus the `mcpServers` and `lspServers` blocks (see [Server wiring](#server-wiring)).
- `skills/` — every `/silk:*` skill, each a `SKILL.md` with optional bundled `references/` and `scripts/`.
- `agents/` — the domain agents (`changeset-manager`, `turborepo`, `tsdoctor`). Every agent declares a curated `tools:` allowlist (omitting `tools:` inherits everything and undoes the scoping), and every allowlist includes `SendMessage` — a teammate-dispatched agent without it cannot report back or answer a `shutdown_request` and idle-loops until killed.
- `hooks/` — `hooks.json` plus per-event script dirs and the shared `lib/`. See [plugin-hooks.md](./plugin-hooks.md).
- `monitors/` — `monitors.json` and the background monitor scripts.
- `bin/` — the `sh` launchers for the MCP server and the Biome LSP.
- `tests/` — the bats + shellcheck harness for hooks, monitors and skill scripts, run by `pnpm test:hooks`. `tests/README.md` documents it.

## Capabilities

Each capability follows roughly the same shape — a skill for judgment, a hook or monitor for enforcement or passive signal and sometimes an agent for heavy work — and each has its own doc:

- [plugin-hooks.md](./plugin-hooks.md) — the hook infrastructure: `hooks.json` merge rules, the three SessionStart hooks and the always-on orientation payload, the `SILK_*` session env, working-tree resolution and the shared lib.
- [plugin-changesets.md](./plugin-changesets.md) — the `/silk:changeset` router, the `changeset-manager` agent and its internal skills, changeset validation and the Stop-time nudge.
- [plugin-commit-messages.md](./plugin-commit-messages.md) — `commit-create`, `pr-body` and the commit-message guard hooks.
- [plugin-biome.md](./plugin-biome.md) — the Biome LSP, the `biome_check` MCP channel and the deny/nudge hooks on Bash Biome.
- [plugin-turbo.md](./plugin-turbo.md) — the read-only Turborepo capability: `turbo` skill, `turborepo` agent and the safe-bash line.
- [plugin-build-tsdoc.md](./plugin-build-tsdoc.md) — the `build` and `tsdoc` skills, the `tsdoctor` agent and the `tsdoc-diagnostics` monitor over `dist/<target>/issues.json`.
- [plugin-repos.md](./plugin-repos.md) — the vendored-repos capability: `repos` skill, orientation hook, three guards and the `gitmodules-drift` monitor.
- [plugin-dogfood.md](./plugin-dogfood.md) — the cross-repo dogfood mailbox protocol: `dogfood` skill, push guard and `dogfood-mail` monitor.
- [plugin-it2.md](./plugin-it2.md) — iTerm2 pane orchestration for subagents: the `it2` skill and the gated orientation block.

## Skill naming scheme

The naming scheme is the load-bearing convention; the `skills/` directory is the authoritative list.

- **User-facing skills are tool-prefixed** — the `changeset` router and its `changeset-style`/`changeset-config` siblings, `commit-create` — because several tools share one plugin. `pr-body` is the one message-authoring skill named for its document rather than a tool, since no tool owns a PR description. Capability skills are named for their capability (`build`, `tsdoc`, `turbo`, `repos`, `dogfood`, `it2`).
- **Internal mechanics stay unprefixed** (`config`, `dependencies`, `update`, `merge`, `delete`, `status`). They are not user-invoked — only the `changeset-manager` agent calls them by name.

## Server wiring

- **MCP.** The `mcpServers` block in `plugin.json` spawns the shared `savvy-mcp` server (`@savvy-web/mcp`, tools-only) via `sh bin/start-mcp.sh`. The SessionStart orientation hook then points the agent at the tools it should prefer — see [plugin-hooks.md](./plugin-hooks.md#the-orientation-payload).
- **LSP.** The `lspServers.biome` block launches Biome's language server via `sh bin/biome-lsp.sh`; see [plugin-biome.md](./plugin-biome.md). Neither launcher bundles a binary — both expect the tool on `PATH` or resolvable from the project.

## Rationale

### Why one plugin, prefixed skills

The three original tools (changesets, commitlint, lint-staged) are installed and configured as a unit, so a consumer wants one plugin, not three. Merging removes per-plugin ceremony; tool-prefixing the user-facing skills keeps the merged namespace legible, while agent-only mechanics stay short because no human types them.

### Why hooks target the single savvy bin

The point of the merge is one bin. Hooks that shelled out to per-tool bins would defeat it and require the old packages installed. Every hook and skill script that reaches the Silk CLI goes through `savvy changeset …` / `savvy commit hook …` via the shared resolver in `hooks/lib/run-cli.sh`.
