---
status: current
module: docs
category: architecture
created: 2026-06-01
updated: 2026-06-01
last-synced: 2026-06-01
completeness: 90
related:
  - ../mcp/architecture.md
  - ../silk/plugin.md
dependencies:
  - ../mcp/architecture.md
---

# plugins/docs — the corpus authoring plugin

The `docs@savvy-web-systems` Claude Code plugin: the third plugin in the marketplace, companion to `plugins/silk` and `plugins/github-actions`. Where those two plugins orient agents toward *reading* the `@savvy-web/mcp` corpus, this plugin owns the *write* side — authoring, improving and registering docs in `packages/mcp/src/resources/content/`.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The mcp agent](#the-mcp-agent)
- [Checkout resolution](#checkout-resolution)
- [Capability skills and the live contract](#capability-skills-and-the-live-contract)
- [Mode commands](#mode-commands)
- [Orientation hook](#orientation-hook)
- [The three-tier query/authoring split](#the-three-tier-queryauthoring-split)
- [Rationale](#rationale)

## Overview

The corpus that `savvy-mcp` serves (`silk://catalog` plus the `silk://{+path}` resources, see `../mcp/architecture.md`) is hand-authored markdown under `packages/mcp/src/resources/content/{standards,packages,guides}/`. Authoring it correctly requires knowing a non-trivial contract: the front-matter schema, the tier-to-directory double-check, the controlled tag vocabulary, dead-name bans and per-tier body budgets, all gated by `build:catalog`. `plugins/docs` packages that knowledge as an agent plus skills so any session — from any repo — can write to the corpus correctly.

**Location:** `plugins/docs` in `savvy-web/systems`
**Marketplace name:** `docs@savvy-web-systems` (`source: "./plugins/docs"`)

It is a separate plugin, not part of silk, on purpose: authoring direction costs context an agent only pays when it is actually authoring. A consumer that only reads docs installs silk; a doc author installs docs. This is the same context-cost-proportional-to-need principle as the information-vs-direction split, one level down — see [the three-tier split](#the-three-tier-queryauthoring-split).

The plugin spawns the same shared `savvy-mcp` server as the other two plugins (its `plugin.json` carries the identical `mcpServers` block and `bin/start-mcp.sh` launcher). With silk and docs both active, two server instances spawn; the server is stateless and lightweight, so that double-spawn is acceptable — the same tradeoff the MCP architecture doc declares.

## Current State

Implemented for 0.1.0. The plugin contains one agent, two capability skills, two mode commands and one orientation hook. The **`audit` mode was deliberately deferred** to post-0.1.0 (a corpus-wide fan-out that can exhaust the agent turn budget); the skill factoring is built so the future `github`/`rspress`/`npm` docs agents reuse `corpus-authoring` + `corpus-verify` unchanged.

Registered in the root `.claude-plugin/marketplace.json`; the changeset surface maps the plugin's version to `@savvy-web/mcp` via `versionFiles` in `.changeset/config.json` (the corpus and its authoring tools version together).

## The mcp agent

`agents/mcp.md` is the corpus documentation agent. See the file for the full system prompt; the load-bearing facts:

- **Restrictive `tools:` allowlist.** Claude Code treats an explicit `tools:` list as exhaustive — unlisted tools are unavailable. Because the agent *must* read `silk://catalog` and call the server tools, those ids are listed explicitly: `ListMcpResourcesTool`, `ReadMcpResourceTool`, `mcp__savvy-mcp__silk_docs_search`, `mcp__savvy-mcp__workspace_info`, alongside `Read/Grep/Glob/Write/Edit/Skill/AskUserQuestion` and the `Bash(... *)` set including `Bash(gh *)`. The permission syntax is the **space-glob** form `Bash(git *)`, the canonical form — not the colon form `Bash(git:*)`.
- **Two modes, one preamble.** A shared preamble (boundaries, the catalog-first rule restated, checkout resolution, live-contract rule, verification, cross-repo hygiene) plus a per-mode section (`write-guide`, `improve`), set by a literal `Mode:` line in the dispatch prompt. This mirrors the `changeset-manager` Mode-1/Mode-2 shape so the modes share code.
- **The catalog-first rule is restated in the body.** Subagents do not inherit the main session's SessionStart hook context, so the "read `silk://catalog` / `silk_docs_search` before guessing" rule that the orientation hooks emit must be repeated inside the agent prompt itself.
- **`skills: [corpus-authoring]` preloaded; `corpus-verify` lazy-loaded** as a post-write gate (the agent body says "after any write, invoke `corpus-verify`"), mirroring how `changeset-manager` lazy-loads `changeset-check`.
- `model: sonnet`, `maxTurns: 20`, `color: magenta`.

## Checkout resolution

The corpus lives in a `savvy-web/systems` checkout that may differ from the agent's current repo, so the agent resolves it in a four-step chain, stopping at the first hit: (1) `$SAVVY_SYSTEMS_DIR` if set; (2) the current repo if its git origin is `savvy-web/systems`; (3) scan the session's additional working directories for a path ending in `savvy-web/systems` (the agency checks repos out under `org/repo`); (4) ask the user. It never guesses a path that fails resolution.

The constraint that shapes this: **environment variables do not persist between Bash tool calls.** Steps 1–2 are therefore re-run inside every helper script (a cheap git check); when the agent resolves via step 3/4 it threads the path inline by prefixing each helper invocation `SAVVY_SYSTEMS_DIR=<path> bash <script>`. The env-override name deliberately names the systems repo, not the docs plugin.

## Capability skills and the live contract

Two capability skills under `skills/`, both `disable-model-invocation: false` (independently invocable and reusable by future docs agents) with `allowed-tools: Bash(bash *)`:

- **`corpus-authoring`** — prose conventions (tier rubric, the tier/id double-check, the `related[]` policy, the propose-then-add tag workflow) plus `scripts/show-contract.sh`. The skill body names only the *stable invariants* (required front-matter fields exist; `tier` must equal the content directory AND `id` must start with `<tier>/`; `related[]` resolves to live corpus ids and never to a generated `api/*` id; hand docs are `source: hand`).
- **`corpus-verify`** — `scripts/build-catalog.sh` (runs `build:catalog` via turbo, passes stderr through, exits with turbo's code) and `scripts/build-catalog-json.sh` (parses the `[build-catalog] ERROR|WARN` and `wrote manifest with N entries` lines into `{ errors, warnings, entryCount, pass }`).

**The contract is read live, never embedded.** This is the central design decision of the skill layer. `show-contract.sh` reads the *current* schema, `ID_PATTERN`, tag vocabulary, dead-names and body budgets directly from `schema.ts` / `tags.json` / `build-catalog.ts` in the resolved checkout at invocation time. No copy of those values lives in the skill, so the skill cannot drift from the source when the contract changes. See `plugins/docs/skills/corpus-authoring/scripts/show-contract.sh` for the extraction; the agent runs it before authoring rather than working from memory.

**Unknown-tag handling is propose-then-add.** Tags are a controlled vocabulary and unknown tags fail the build. When a doc needs a concept outside the vocabulary, the agent names the closest canonical tag and offers three choices — use the existing tag, add the new one to `tags.json` on approval, or pick another term — and never grows the vocabulary silently.

## Mode commands

Two user-invoked mode commands under `skills/`, both `disable-model-invocation: true` (user-timed, never model-triggered). Each is a thin dispatcher that calls the `Agent` tool with `subagent_type: mcp` and a prompt carrying a literal `Mode:` line, the raw `$ARGUMENTS` and a report-back instruction — the exact `changeset-create → changeset-manager` dispatch pattern. The commands do not call `AskUserQuestion` themselves; they pass arguments through (possibly empty) and let the agent ask, so the agent can offer catalog-derived candidates.

- **`write-guide`** (`/docs:write-guide [topic] [--pr]`) — boots the agent in write-guide mode: resolve checkout, read the catalog and surface any overlapping doc (ask new-vs-improve-vs-cancel, never silently switch), research via `silk_docs_search` + `workspace_info` + source reads, draft under `content/guides/` (the default tier), verify, then commit or open a PR.
- **`improve`** (`/docs:improve [doc-id-or-path] [--pr]`) — boots the agent in improve mode: resolve the doc (from the arg, else search + ask), read it and the catalog to refresh stale `related[]`, fix staleness / over-budget / broken refs / outdated status, verify, then commit or PR.

**Write-back hygiene.** Inherited shell env can target the wrong account or repo, so at every `gh` call site the agent scrubs `GH_TOKEN="" GITHUB_TOKEN="" GH_REPO="" GH_PAGER=cat gh ...` (`GH_REPO` is the highest-consequence — an inherited value PRs to the wrong repository), and for commits it protects the intended DCO identity against inherited `GIT_AUTHOR_*`/`GIT_COMMITTER_*`. Default is a DCO-signed commit; `--pr` opens a PR instead.

## Orientation hook

`hooks/session-start/orientation.sh` is a lean nudge announcing the authoring assistant and pointing at `/docs:write-guide` / `/docs:improve`, plus the catalog-first reminder. It drains stdin (`cat >/dev/null`) and sources the shared `hooks/lib/hook-output.sh` copied verbatim from silk (`hook-debug.sh` has only its `HOOK_LOG_PREFIX` changed to `docs`). For 0.1.0 the plugin registers SessionStart only.

## The three-tier query/authoring split

The reason docs is a separate plugin, and the reason its orientation hook stays a thin nudge, is one architectural idea: **direction is layered by frequency-of-need and context cost.**

1. **Tier 1 — always-on SessionStart nudge** in each plugin. Fires on every session start; must stay tiny. It states the catalog-first / search-before-grep / `workspace_info`-default rules and nothing more.
2. **Tier 2 — the on-demand `docs-search` skill in the silk plugin** (the *read* side). Loads only when an agent is actually querying the corpus, carrying query best-practices that would bloat the always-on payload. Lives in silk because every silk consumer benefits from the read side — see `../silk/plugin.md`.
3. **Tier 3 — this plugin** (the *write* side). Loads only when authoring, costing context only to doc authors.

Each tier pays context only in proportion to how often it is needed. This is the same principle as the MCP's information-vs-direction split (information in the server, direction in the plugins), applied one level finer to the direction half itself.

## Rationale

### Why a separate plugin, not a silk skill

Authoring the corpus is a specialized, infrequent task with a heavy contract. Folding the agent and its two capability skills into silk would charge every silk session — most of which only read docs — for authoring context they never use. A separate plugin keeps the write side out of the read-side budget, and gives the future `github`/`rspress`/`npm` docs agents a natural home that already factors `corpus-authoring` + `corpus-verify` for reuse.

### Why the contract is read live

A copy of the schema/tags/budgets embedded in the skill would be a second source of truth that silently drifts every time the real contract in `packages/mcp` changes. Reading it live from `schema.ts` / `tags.json` / `build-catalog.ts` at invocation time means the agent always authors against today's contract, and the `build:catalog` gate it runs afterward is checking the same rules the agent was just shown.

### Why the agent resolves a checkout

The corpus is one specific repo (`savvy-web/systems`), but the agent may be dispatched from any repo in the ecosystem. Resolving the checkout — rather than assuming the current directory — lets a doc-authoring request succeed from anywhere, while the `SAVVY_SYSTEMS_DIR` override and the permitted-directory scan cover the agency's standard `org/repo` checkout layout without prompting.
