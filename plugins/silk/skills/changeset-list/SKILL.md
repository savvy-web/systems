---
name: changeset-list
description: >
  List all pending changeset files in .changeset/ with a summary showing
  filename, affected packages, bump types, and first line of content.
  Use to get an overview of queued changes before release.
when_to_use: >
  "what changesets are pending", "show me the changesets", "list changesets",
  "summarize the pending releases", "what's queued for release",
  "what packages have changesets ready"
model: sonnet
allowed-tools: Bash(bash *)
---

# List Pending Changesets

This skill wraps `@changesets/cli`'s `status` command to produce a structured listing of pending changesets and the releases they describe. The CLI is assumed installed in the project (it ships alongside `@savvy-web/changesets` as a peer/dev dependency).

## Step 1 — Run the bundled list script

Use the Bash tool:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/changeset-list/scripts/list.sh"
```

The script:

- Resolves project dir and package manager the same way the other plugin scripts do.
- Invokes `<pm> exec changeset status --output=<tmpfile>` to capture structured JSON.
- Pass-through prints the JSON to stdout, with stderr noise from the CLI suppressed.

## Step 2 — Parse and summarize

The JSON has two top-level keys:

| Key | Shape |
| --- | --- |
| `changesets` | Array of `{ id, summary, releases: [{ name, type }], packageJson?, … }` — one entry per `.changeset/*.md`. |
| `releases` | Array of `{ name, type, oldVersion?, newVersion?, changesets: [<id>, …] }` — one entry per package that will be bumped, with cross-references to which changesets contribute. |

Present a human-readable summary:

1. Total count of pending changesets.
2. For each release: package name, bump type, the list of changeset ids contributing, and a one-line summary of each.
3. Any packages that appear in multiple changesets — call them out as candidates for `/silk:changeset-squash`.

## Step 3 — Empty / missing cases

- If the script's JSON has an empty `changesets` array, report `No pending changesets` and stop.
- If the script prints `{"note":"no .changeset/ directory"}`, report that and stop.
- If the script exits non-zero with "CLI is not installed," report that and suggest installing `@changesets/cli`.

## Output style

- Concise. One row per changeset and per release.
- File paths relative to the project root (`.changeset/brave-dogs-laugh.md`).
- Lead with the count, then the per-changeset rows, then any squash hints at the bottom.

Do not propose edits or run validation here — that's `/silk:changeset-check`'s job.
