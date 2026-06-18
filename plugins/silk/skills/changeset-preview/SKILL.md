---
name: changeset-preview
description: >
  Preview what the combined CHANGELOG output would look like with all
  pending changesets. Shows each package's version bump and the rendered
  release notes, produced by the real changeset formatter. Use to review
  before merging.
when_to_use: >
  "preview the changelog", "what will the release notes look like",
  "preview the release", "show me what the CHANGELOG would say",
  "render the pending release notes", "what would users see if I shipped now"
allowed-tools: mcp__plugin_silk_savvy-mcp__changeset_preview
model: sonnet
---

# Preview Pending Changeset Output

Render a preview of what the next release would produce — version bumps and
CHANGELOG entries — using the genuine changeset engine. This is read-only;
nothing is written.

## Step 1: Call the preview tool

Call the `mcp__plugin_silk_savvy-mcp__changeset_preview` tool. Pass `cwd` only
if you need to target a workspace other than the current directory.

The tool runs the real changesets release engine against the pending
`.changeset/` files in a throwaway directory and returns:

- `releases[]` — per package: `name`, `type` (major/minor/patch), `oldVersion`,
  `newVersion`, `changesetIds`, and `changelogEntry` (the rendered, transformed
  CHANGELOG block, dependency tables included).
- `changesets[]` — the parsed pending changesets.
- `preMode` — the pre-release mode, if active.

## Step 2: Render the preview

The tool already returns a formatted markdown transcript in its text content:
a "Version bumps" table followed by each package's release notes. Present that
to the user as-is. If they ask for detail on a specific package, read that
package's `changelogEntry` from the structured content.

If `releases` is empty, report "No pending changesets" and stop.

## Output Guidance

- Do not validate changeset format or report rule violations — use
  `/silk:changeset-check` for that.
- Do not modify any files — this is a read-only preview.

> **Preview reflects the working tree.** Changeset files are not yet committed,
> so author, PR, and commit links won't resolve until release. `savvy changeset
> version` run at this same point has the identical gap, so content and ordering
> match what ships.
