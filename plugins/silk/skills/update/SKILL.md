---
name: update
description: >
  Mechanics for modifying an existing changeset file. Invoked by the
  changeset-manager agent when the diff has grown since the changeset was
  authored, when a bump-type mismatch is detected, or when a squash needs
  to rewrite an entry's content. Not user-invokable; users initiate this
  work via /silk:changeset --create.
user-invocable: false
model: sonnet
---

# Update Changeset Mechanics

This is an agent-internal procedural skill. The invoking agent has already decided that a specific changeset needs to be modified and has identified what to change. Your job is the file-level mechanics, the structural validation, and the modified-file report.

If the `changeset-style` skill is not already in scope, invoke it via the `Skill` tool before drafting any content — it contains the 13 valid section headings, CSH001–CSH005, and the depth tiers that the modified file must continue to satisfy.

## Step 1 — Read the target

The agent passes the target filename and a structured edit spec describing what to change. Resolve the filename to a full path under `.changeset/` and read its current contents. If the file does not exist, return a failure record to the invoking agent.

## Step 2 — Apply the edits

Edit categories the agent may pass:

- **Content** — add, remove, or rewrite sections; revise bullets or prose under a section.
- **Bump type** — change the bump level for one or more packages in the frontmatter.
- **Affected packages** — add or remove package entries in the frontmatter.

When applying edits:

- Preserve valid structure: YAML frontmatter block, valid `##` headings from the 13 known categories, no content before the first `##` heading, no `#` h1 headings, no heading depth skips.
- Preserve section ordering unless explicitly asked to reorder.
- Do not rewrite content the agent did not flag for change.
- Re-apply the exclusion rules from the agent's system prompt — if an edit would add a bullet about AI-context, internal-design-doc, or behavior-neutral config changes, drop it.

## Step 3 — Write back

Write the modified content back to the same file path. Do not rename the file or change directories.

## Step 4 — Return a structured report

Return to the invoking agent:

- The file path written
- A diff-style summary of what changed (frontmatter changes, section additions/removals/rewrites)
- Any structural concerns surfaced during the edit (e.g., a section the agent asked to remove was the only section in the file)

User confirmation belongs at the entry-point skill, not here.
