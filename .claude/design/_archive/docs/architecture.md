---
status: archived
module: docs
category: architecture
created: 2026-06-01
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
archived: 2026-07-01
archival-reason: plugins/docs was deleted with the @savvy-web/mcp resource subsystem it authored for (savvy-web/systems#200); nothing remains to document
related:
  - ../../mcp/architecture.md
  - ../../silk/plugin.md
dependencies: []
---

# plugins/docs — the corpus authoring plugin

> **ARCHIVED (2026-07-01) — describes a plugin that no longer exists.**
>
> `plugins/docs` was deleted in the same change that removed the `@savvy-web/mcp` resource subsystem it wrote to (savvy-web/systems#200). `savvy-mcp` is now a tools-only server with no `silk://` corpus, no `silk_docs_search` tool and no `packages/mcp/public/content/` tree, so there is nothing left to author — see [`../../mcp/architecture.md`](../../mcp/architecture.md). The repo's only Claude Code plugin today is `plugins/silk` (`plugins/github-actions` is also gone — see [`../github-actions/plugin.md`](../github-actions/plugin.md)), and silk no longer carries a `docs-search` skill — see [`../../silk/plugin.md`](../../silk/plugin.md). API documentation is expected to move to a separate RSPress website built from each package's `.api.json` model.
>
> Everything below is written in the past tense and preserved only for the design decisions it records: the read/write plugin split, reading a contract live instead of embedding it and resolving a target checkout from any repo. Do not use it to locate code.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [What the plugin contained](#what-the-plugin-contained)
- [Rationale](#rationale)

## Overview

The `docs@savvy-web-systems` plugin was the write-side companion to `plugins/silk`. Where silk oriented agents toward *reading* the markdown corpus that `savvy-mcp` then served as `silk://` resources, `plugins/docs` owned *authoring* it: drafting new guides, improving existing docs and registering them so the corpus build (`build:catalog`) accepted them.

Authoring the corpus correctly meant satisfying a non-trivial contract — front-matter schema, a tier-to-directory double-check, a controlled tag vocabulary, dead-name bans and per-tier body budgets. The plugin packaged that knowledge as one agent plus a small set of skills so any session, from any repo in the ecosystem, could write to the corpus without re-deriving the rules.

## Current State

Deleted. No file under `plugins/docs` exists, the marketplace manifest at `.claude-plugin/marketplace.json` lists only `silk` and the corpus the plugin targeted was removed from `@savvy-web/mcp` in the same change. The `docs` module has been removed from `.claude/design/design.config.json`; the unrelated `docs/` directory at the repo root is a placeholder docs-site area, not this plugin.

## What the plugin contained

Recorded at the level of shape, not mechanics:

- **One agent, two modes.** A corpus-authoring agent with a shared preamble and a per-mode section (`write-guide`, `improve`), selected by a literal `Mode:` line in the dispatch prompt — the same dispatcher-plus-agent shape silk uses for its changeset work. The catalog-first rule was restated inside the agent body because subagents do not inherit the main session's SessionStart hook context.
- **Two capability skills, reusable by design.** `corpus-authoring` held the prose conventions and a script that printed the live contract; `corpus-verify` wrapped the `build:catalog` gate and summarised its output. Both were independently invocable so future docs agents for other targets could reuse them unchanged.
- **Two user-invoked mode commands.** Thin dispatchers that passed `$ARGUMENTS` through to the agent and let *it* ask clarifying questions, so it could offer catalog-derived candidates rather than guessing.
- **Checkout resolution.** The corpus lived in a `savvy-web/systems` checkout that might not be the agent's current repo, so the agent resolved it through an ordered chain — `$SAVVY_SYSTEMS_DIR`, the current repo if its origin matched, the session's additional working directories, then ask — and never guessed a path that failed resolution. Because environment variables do not persist between Bash tool calls, the cheap steps re-ran inside every helper script and a resolved path was threaded inline per invocation.
- **A SessionStart-only orientation hook.** A lean nudge announcing the authoring commands and repeating the catalog-first reminder, sharing its hook library with silk.

## Rationale

### Why a separate plugin, not a silk skill

Direction was layered by frequency of need and context cost: an always-on SessionStart nudge in every plugin (tiny), an on-demand read-side search skill in silk (loaded only when querying) and the write side in its own plugin (loaded only when authoring). Folding the agent and its skills into silk would have charged every silk session — most of which only read docs — for authoring context they never used. This was the MCP architecture's information-vs-direction split applied one level finer, to the direction half itself.

### Why the contract was read live

An embedded copy of the schema, tag vocabulary and body budgets would have been a second source of truth that drifted every time the real contract in `packages/mcp` changed. The authoring skill instead extracted the current values from the corpus source at invocation time, so the agent always authored against today's contract and the `build:catalog` gate it ran afterward checked the same rules it had just been shown.

### Why the agent resolved a checkout

The corpus was one specific repo, but the authoring request could come from any repo in the ecosystem. Resolving the target checkout — rather than assuming the current directory — let the request succeed from anywhere, while the env override and the working-directory scan covered the standard `org/repo` checkout layout without prompting.
