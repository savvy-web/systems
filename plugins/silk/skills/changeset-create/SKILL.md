---
name: changeset-create
description: >
  Reconcile changesets with the current branch. Inventories existing changesets,
  diffs against the default branch, applies exclusion rules (AI context, design
  docs, trivial config), and decides whether to create, update, or delete
  changeset files so the .changeset/ directory accurately describes the release.
when_to_use: >
  "I need a changeset for this branch", "draft a changeset", "add a changeset",
  "reconcile the changesets with the diff", "version bump", "the release
  documentation is out of date", "make sure changesets exist for what I just
  shipped", "do I need a changeset for this branch?"
argument-hint: "[--require] [--package <name>] [--bump patch|minor|major] [--dry-run]"
---

# Create / Reconcile Changesets

The user invoked `/silk:changeset-create` with arguments: `$ARGUMENTS`

## What to do

Dispatch the `changeset-manager` agent in **create** mode. The agent owns the discover-and-decide logic — your job is to hand off the arguments verbatim and report the agent's result back to the user.

Use the `Agent` tool with `subagent_type: changeset-manager` and a prompt that includes:

1. **Mode**: `create`
2. **Arguments received from the user**: `$ARGUMENTS`
3. **Reminder**: apply the exclusion rules (AI context documents, internal design docs, trivial doc tweaks alongside code, behavior-neutral config) and the depth guidance from the agent's system prompt. The goal is release documentation, not a changelog of the diff.

## Argument semantics

The agent will parse `$ARGUMENTS` according to these flags:

| Flag | Effect |
| --- | --- |
| `--require` | Assert that a changeset must exist for this branch even if the agent's judgment is "no changeset needed." Creates a conservative-bump entry for the most-affected package. |
| `--package <name>` | Restrict the action set to the named package(s). Repeatable; also accepts comma-separated. |
| `--bump patch\|minor\|major` | Override the agent's auto-classification. |
| `--dry-run` | Print the plan as a table; write nothing. |

If `$ARGUMENTS` is empty, the agent runs with full discretion: it discovers what exists, diffs against the base branch, classifies the work, and acts on its own judgment. It will ask only when ambiguity affects the public release surface.

## When the agent finishes

Surface the agent's report to the user:

- Files created, updated, deleted
- Packages classified and their assigned bump types
- Categories of change that were deliberately skipped (per the exclusion rules)
- Any questions the agent needed to ask along the way

Do not editorialize the result — the agent's own summary is the source of truth.
