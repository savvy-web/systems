---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-05-31
last-synced: 2026-05-31
completeness: 85
related:
  - ./architecture.md
  - ../cli/architecture.md
dependencies: []
---

# plugins/silk — merged Claude Code plugin

The `silk@savvy-web-systems` Claude Code plugin. Merges the skills, agent and hooks of the three
source plugins (changesets, commitlint, lint-staged) into one, repointed at the unified `savvy` bin.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Skill Naming Scheme](#skill-naming-scheme)
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
- **Agent** (`plugins/silk/agents/changeset-manager.md`): carried over unchanged from the changesets
  plugin; it is the only caller of the unprefixed internal skills.
- **Hooks** (`plugins/silk/hooks/`): all three source hook sets merged into one `hooks.json` plus
  per-event script dirs (`session-start`, `pre-tool-use`, `post-tool-use`, `user-prompt-submit`)
  and a shared `lib/`.

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

## Hook Merge

All three source hook sets merge into `plugins/silk/hooks/hooks.json`. SessionStart payloads
consolidate (one hook entry per source); PreToolUse/PostToolUse matchers combine across the
changesets push-guard and the commitlint bash/fs/mcp guards. Every hook script is **repointed** from
the legacy `savvy-changesets …` / `savvy-commit …` bins to the unified `savvy changeset …` /
`savvy commit hook …` paths; the shared resolver in `hooks/lib/` targets the single `savvy` bin.

The open hygiene concern (carried from the spec) is avoiding double-fires where the changesets and
commitlint guards both match `Bash` — check `hooks.json`'s matcher set when adding a new Bash guard.

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
