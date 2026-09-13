---
type: Convention
title: Split commit messages and PR descriptions on document, not command
description: "Anything that becomes a conventional-commit subject (the commit message, the PR title, a proposed-squash-commit fence) follows the commit-create contract; PR description prose follows pr-body and is not held to the commit contract — load the matching skill before composing, not after a hook rejection."
stale_after: 2027-03-12T00:00:00-04:00
tags: [tooling]
sources:
  - id: plugin-commit-messages
    resource: ../../plugins/silk/hooks
  - id: claude-md
    resource: ../../CLAUDE.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 22446b4f1d9c2b206f180ef2f08a4485ed98a3f4b7af8cf7c4c562f29c4e3d0c
---

# Split commit messages and PR descriptions on document, not command

The commit message and the PR description are one editorial system with a division of labor, not two independent formats — and the split is on DOCUMENT, not on command. `gh pr create --title --body` spans both documents in one invocation, so a single command routinely needs both skills.[^plugin-commit-messages]

## commit-create

Anything that is or becomes a conventional-commit subject — the commit message, the PR title, or the contents of a `proposed-squash-commit` fence inside a PR description — follows the [silk:commit-create](../modules/silk-plugin.md) contract: conventional commits, DCO signoff via `@savvy-web/commitlint`, type enum, TDD scope grammar, subject rules, and comma-separated `Closes` trailers. Load the skill BEFORE composing a commit message, not after a hook rejects one.[^claude-md]

Bodies stay short: the repo squash-merges, so a long commit body is discarded at merge. Write plain prose with no inline backtick code — commitlint rejects it. Depth belongs in the PR, not the commit.[^plugin-commit-messages][^claude-md]

## pr-body

PR description prose follows [silk:pr-body](../modules/silk-plugin.md) and is explicitly NOT held to the commit contract — only `plan-leakage` and `closes-trailer` gate it, so headers and fences are fine there. A PR body is a marker contract, not a template: several writers (a release action's regenerated managed region, humans, agents) share one description via HTML-comment markers, and the skill states which regions an agent owns versus which are rebuilt wholesale.[^plugin-commit-messages][^claude-md]

The two `Closes` spellings are both load-bearing and are NOT interchangeable: comma-joined on one line inside a `proposed-squash-commit` fence (because commitlint reads that fence as a commit message), and one bare `Closes #N` per line outside any fence (because GitHub's issue linker reads only that form — a reference inside a code fence is inert). The marker grammar is the [pr-body-contract](../interfaces/pr-body-contract.md) interface; this convention is the consumer-side half.[^plugin-commit-messages]

## The guard hooks

Three PreToolUse hooks route commit-shaped operations through `savvy commit hook pre-commit-message`: `commit-bash.sh` (matches `Bash`, auto-allowing safe read-only commands and routing commit-related ones — `git commit`, `gh pr create`/`pr edit` — through the CLI gate), `commit-mcp.sh` (the same for GitKraken/GitHub MCP operations), and `commit-fs.sh` (message files written to disk via `Read`/`Write`/`Edit`). A PostToolUse hook, `commit-bash.sh`, runs `savvy commit hook post-commit-verify` after a commit lands. All four route through the single `savvy` bin. Never work around one of these hooks or disable a check to get a commit through — stop and report if something blocks you.[^plugin-commit-messages]

[^plugin-commit-messages]: `../../plugins/silk/hooks` — the four commit guards: `pre-tool-use/commit-bash.sh`, `pre-tool-use/commit-mcp.sh`, `pre-tool-use/commit-fs.sh`, `post-tool-use/commit-bash.sh`
[^claude-md]: [CLAUDE.md](../../CLAUDE.md), "Commits"
