---
name: delete
description: >
  Mechanics for removing one or more changeset files from .changeset/. Invoked
  by the changeset-manager agent when a stale changeset describes packages no
  longer in the diff, or as part of squash cleanup. Not user-invokable; users
  initiate this work via /silk:changeset --create or /silk:changeset --squash.
user-invocable: false
model: sonnet
---

# Delete Changeset Mechanics

This is an agent-internal procedural skill. The invoking agent has already decided that one or more changeset files should be removed. Your job is the file-level mechanics and the cleanup report.

## Step 1 — Resolve targets

The agent passes one or more changeset filenames (with or without the `.changeset/` prefix or `.md` extension). Resolve each to a full path under `.changeset/`. If a target does not exist, record the failure but continue with the rest.

## Step 2 — Capture a one-line summary per target

Before deletion, read each target and capture:

- **Packages**: package-to-bump-type mappings from the frontmatter.
- **Summary**: the first non-empty content line in the body.

This is data for the agent's final report, not user-facing confirmation prompts. The decision to delete has already been made upstream.

## Step 3 — Delete

For each resolved target:

```bash
rm .changeset/<filename>.md
```

Continue past individual failures. Record them for the report.

## Step 4 — Return a structured report

Return to the invoking agent:

- Files deleted (with their captured summaries)
- Files that failed to delete and why

The agent will fold this into its overall reconcile / squash report. Do not prompt the user — confirmation belongs at the entry-point skill, not here.
