---
status: current
module: silk
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 88
related:
  - ./plugin.md
  - ./plugin-hooks.md
  - ./plugin-changesets.md
  - ../cli/architecture.md
  - ../silk-effects/architecture.md
dependencies: []
---

# plugins/silk — commit and PR message capability

Two authoring skills of the [silk plugin](./plugin.md) — `commit-create` and `pr-body` — plus the `savvy commit hook` guards they share. The organizing decision: **the commit message and the PR description are one editorial system with a division of labor**, not two independent formats.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Division of labor](#division-of-labor)
- [commit-create](#commit-create)
- [pr-body](#pr-body)
- [The guard hooks](#the-guard-hooks)
- [Rationale](#rationale)

## Overview

`skills/commit-create/` and `skills/pr-body/` author the two documents; `hooks/pre-tool-use/commit-{bash,fs,mcp}.sh` and `hooks/post-tool-use/commit-bash.sh` gate them through the `savvy commit hook` CLI, whose rules live in `@savvy-web/commitlint` via silk-effects.

## Current State

Implemented. Both skills and all four hooks ship as described; the skill files and `hooks/lib/safe-bash-patterns.txt` / `safe-mcp-*.txt` are authoritative for the contract and the allowlists.

## Division of labor

- **The split is on document, not on command.** Anything that is or becomes a conventional-commit subject — the commit message, the PR title, the contents of a `proposed-squash-commit` fence — belongs to `commit-create`; PR description prose belongs to `pr-body` and is explicitly not held to the commit contract. `gh pr create --title --body` spans both documents in one command, so a single invocation routinely needs both skills; triggers keyed on commands rather than documents make the two skills claim the same work and give opposite guidance.
- **Depth belongs in the PR, not the commit.** The repo squash-merges, so a long commit body is discarded at merge and the PR description is what survives. `commit-create` teaches a hard shape (a few bullets or one to two short paragraphs); `pr-body`'s summary region is where reasoning, evidence and migration guidance go. The silk-effects `verbosity` rule's thresholds are sized to that shape and move with it (`../silk-effects/architecture.md`).

## commit-create

`skills/commit-create/SKILL.md` defines the full contract enforced by `@savvy-web/commitlint`: type enum, TDD scope grammar, subject rules, the body brevity doctrine, DCO signoff, comma-separated `Closes` trailers and signing posture. Two rules about the skill itself:

- **Its format is calibrated against what the preset actually enforces**, not what it looks like it might. Verify any claim about the preset against the rule source in silk-effects before writing it into the skill; the skill's authority is that it matches the enforcing code.
- **`scripts/validate-message.sh` reproduces the hook's parse, so its silence must mean the same thing.** A pre-flight validator that disagrees with the gate is worse than none. `scripts/commit.sh` is the one command that actually commits; both resolve their tree via `hooks/lib/resolve-cli-project-dir.sh` (see [plugin-hooks.md](./plugin-hooks.md#working-tree-resolution)).

## pr-body

`skills/pr-body/SKILL.md` documents a **marker contract, not a template**. A release PR description has several writers — the release action regenerates its managed region on every push, humans type above it, agents write into it — and HTML-comment markers keep them apart. The skill says which regions the agent owns, which are rebuilt wholesale and that a `proposed-squash-commit` fence is a commit message subject to `commit-create`. The marker grammar is shared with `savvy-web/silk-release-action` through silk-effects' `PrBody` namespace (`../silk-effects/architecture.md`); the skill is the consumer-side half.

The two `Closes` spellings are both load-bearing: comma-joined on one line inside the fence because commitlint reads it as a commit message; one bare `Closes #N` per line outside the fence because GitHub's issue linker reads only that form and a reference inside a code fence is inert.

## The guard hooks

Three PreToolUse hooks route commit-shaped operations through `savvy commit hook pre-commit-message`, whose rules live in the CLI (`../cli/architecture.md`):

- **`pre-tool-use/commit-bash.sh`** (`matcher: "Bash"`) has a hot path and a cold path. `hooks/lib/match-safe-bash.sh` auto-allows commands matching `hooks/lib/safe-bash-patterns.txt` (read-only tools, `--dry` turbo runs) unless they contain a hard-excluded or commit-related segment; everything else that `hooks/lib/is-commit-related.sh` recognizes — `git commit`, `gh pr create`/`pr edit` — goes to the CLI hook, which gates its rules on which document it is looking at (a PR body may open a fence a commit body may not).
- **`pre-tool-use/commit-mcp.sh`** (the GitKraken/GitHub MCP matcher) does the same for MCP commit/PR ops, with read-only op allowlists in `hooks/lib/safe-mcp-*.txt`.
- **`pre-tool-use/commit-fs.sh`** (`matcher: "Read|Write|Edit"`) covers message files written to disk.

`post-tool-use/commit-bash.sh` runs `savvy commit hook post-commit-verify` after a commit lands. All four target the single `savvy` bin through `hooks/lib/run-cli.sh`.

## Rationale

The rules are enforced in the CLI rather than in the hooks so that the same contract applies at the git hook, in the plugin and in CI; the plugin hooks only decide *which* tool calls carry a message worth checking. Keeping `commit-create` and `pr-body` as two skills split on document mirrors the squash-merge reality — the PR description survives, the commit body does not — and stops one skill from giving the other's guidance.
