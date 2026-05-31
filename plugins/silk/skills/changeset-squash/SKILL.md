---
name: changeset-squash
description: >
  Consolidate pending changesets with identical package/bump-type mappings
  into single files. Default scope is "branch" — only changesets added in
  this branch. Pass "all" to include pre-existing changesets that predate
  the branch.
when_to_use: >
  "consolidate changesets", "combine changesets", "merge my changesets",
  "squash my changesets", "I have too many changesets, can you combine them",
  "fold these changesets together", "clean up the .changeset/ directory
  before release."
argument-hint: "[branch|all] [--package <name>] [--dry-run]"
arguments: [scope]
---

# Squash Changesets

The user invoked `/silk:changeset-squash` with arguments: `$ARGUMENTS`

## What to do

Dispatch the `changeset-manager` agent in **squash** mode. Hand off the arguments verbatim. The agent owns the merge mechanics — your job is the handoff and the report-back.

Use the `Agent` tool with `subagent_type: changeset-manager` and a prompt that includes:

1. **Mode**: `squash`
2. **Arguments received from the user**: `$ARGUMENTS`
3. **Explicit rule**: if the requested scope (`branch` or `all`) finds nothing to squash, the agent must report that and stop. It must **not** silently widen the scope.

## Argument semantics

| Positional / flag | Effect |
| --- | --- |
| `branch` (default if omitted) | Squash only changesets that were added in this branch — files present in `.changeset/` on HEAD but not at the merge-base with the default branch. |
| `all` | Squash every pending changeset in `.changeset/`, including those that predate this branch. |
| `--package <name>` | Restrict squashing to groups whose mapping includes the named package. Repeatable. |
| `--dry-run` | Print the plan (sources → target → frontmatter) as a table; do not write or delete. |

Two changesets can squash only if their package-to-bump-type mappings are identical. The agent groups by that mapping, then merges content section-by-section.

## When the agent finishes

Report:

- Groups squashed (sources → target filename)
- Files removed
- Files created
- Anything skipped (single-member groups, `--package` filter exclusions, branch-scope yielded nothing)

If the scope yielded nothing, the agent's report will say so; pass that through to the user without paraphrasing as "no work to do" — the user may want to retry with `all`.
