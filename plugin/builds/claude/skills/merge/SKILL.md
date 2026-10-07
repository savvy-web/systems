---
name: merge
description: >
  Mechanics for consolidating two or more changesets that share an identical
  package-to-bump-type mapping. Invoked by the changeset-manager agent during
  /silk:changeset --squash. Not user-invokable; users initiate this work via
  /silk:changeset --squash.
user-invocable: false
model: sonnet
---

# Merge Changesets Mechanics

This is an agent-internal procedural skill. The invoking agent has already grouped changesets by identical frontmatter mapping and identified which group to merge. Your job is the content combination, the file-level write/delete, and the merged-file report.

If the `changeset-style` skill is not already in scope, invoke it via the `Skill` tool — the merged output must still satisfy CSH001–CSH005.

## Inputs from the invoking agent

- The list of source filenames in the group (all share an identical package-to-bump-type mapping)
- A target filename, or a directive to generate a fresh `<adjective>-<noun>-<verb>.md` filename
- Optional content directives (e.g., "drop bullets matching `<exclusion category>` during the merge")

## Step 1 — Validate inputs

Read each source file. Verify their frontmatter mappings are in fact identical. If they diverge, return a failure to the invoking agent rather than silently merging.

## Step 2 — Combine content sections

- Collect all `##` sections from every source file.
- Where multiple sources contain the same `##` heading, merge their content under a single occurrence of that heading.
- Use `### Sub-headings` to keep distinct contributions separable when they're substantial (named features, independent fix descriptions). Omit sub-headings when items are homogeneous and read naturally as a flat list.
- Re-apply the exclusion rules from the agent's system prompt: drop bullets describing AI-context updates, internal design docs, or behavior-neutral config changes.
- Preserve any code fences and their language identifiers verbatim — they were intentionally authored.

## Step 3 — Resolve the target filename

If the agent passed a target filename, use it. Otherwise generate a fresh `<adjective>-<noun>-<verb>.md` (e.g., `brave-dogs-laugh.md`). Never reuse any source filename.

## Step 4 — Write the merged file and remove sources

1. Write the merged changeset to `.changeset/<target>.md` with the shared frontmatter and combined content.
2. Delete each source file.

## Step 5 — Return a structured report

Return to the invoking agent:

- The target filename written
- The list of source filenames removed
- A diff-style summary of which sections were combined and where sub-headings were introduced

User confirmation belongs at the entry-point skill, not here.
