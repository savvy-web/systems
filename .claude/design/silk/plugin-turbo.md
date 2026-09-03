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

# plugins/silk — Turborepo capability

A read-only Turborepo capability of the [silk plugin](./plugin.md), layered over the `savvy-mcp` server's `turbo_inspect` tool (`../mcp/architecture.md`, backed by silk-effects' `Turbo` namespace): a light always-on nudge, an on-demand skill and a domain agent for heavy work.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Shape](#shape)
- [The read-only line at the Bash layer](#the-read-only-line-at-the-bash-layer)
- [Rationale](#rationale)

## Overview

The pieces: `skills/turbo/` (skill plus `references/`), `agents/turborepo.md` and one entry in `hooks/lib/safe-bash-patterns.txt`. The `turbo_inspect` tool itself lives in `@savvy-web/mcp`.

## Current State

Implemented. The skill, agent and allowlist entry ship as described; `skills/turbo/SKILL.md` and `agents/turborepo.md` are authoritative for the decision trees and modes.

## Shape

- **Orientation.** The `<silk_capabilities>` payload indexes `turbo_inspect` in one line — cache/graph/affected inspection, read-only, never runs tasks — and names the `turborepo` agent and `/silk:turbo` skill. `turbo_inspect` has no hook; it is a read-only tool the agent calls directly.
- **The `turbo` skill** (`skills/turbo/SKILL.md`) is the model-invocable front door: decision trees, an anti-pattern catalog with rationale and bundled `references/` deep dives on the Turborepo standards. It encodes the Silk install/build-decoupling turbo ordering (root `CLAUDE.md`, "Install & Build Orchestration") so recommendations respect the monorepo's CI order.
- **The `turborepo` agent** (`agents/turborepo.md`) is the specialist for work heavier than one question, in three modes: cache diagnosis, graph refactor, affected-CI. Its contract is *diagnose first, recommend second* — it pulls actual hash contributors and graph edges via `turbo_inspect` and edits `turbo.json` only once it can cite the contributor that justifies the change. It preloads the `turbo` skill.

## The read-only line at the Bash layer

`hooks/lib/safe-bash-patterns.txt` auto-allows `turbo … --dry`/`--dry=json` runs through the commit guard's hot path (see [plugin-commit-messages.md](./plugin-commit-messages.md#the-guard-hooks)). The bare `turbo run <task>` form, which executes the task and mutates the cache, is intentionally **not** allowlisted — that is the line that keeps the capability read-only at the Bash layer as well as the tool layer.

## Rationale

Turborepo work is either a quick question or a multi-step diagnosis, so the capability is split into a directly callable skill for the former and an agent for the latter, both over the same read-only tool. Keeping every layer read-only means the plugin can recommend `turbo.json` changes without ever being the thing that executed a task or mutated a cache on the agent's behalf.
