---
"@savvy-web/silk": minor
---

## Features

### Commit messages target a scannable index entry

`commit-create` now asks for three to five bullets, or one to two short paragraphs — roughly eight body lines. The repo squash-merges, so a long body is discarded at merge after costing real time to write; depth moves to the PR description, which outlives the commit. The skill adds a filter for what earns a line and an explicit cut list for what agents habitually include anyway: test counts, investigation evidence, mechanical carry-along renames, file-by-file walkthroughs.

Two points are now stated against what the preset actually enforces rather than what the skill previously implied. Dash bullets are legal, because `silk/body-prose-only` is never enabled and the markdown detector defines a bullets pattern it never tests. Multiple issues go on one comma-separated `Closes #a, #b` line instead of a stacked column.

### New `pr-body` skill for pull-request descriptions

Documents the `silk-release` marker contract that lets humans, local agents and cloud agents share one PR description without overwriting each other: which regions an agent owns, which are regenerated wholesale, and which survive. It records the empirical GitHub-linking behavior — only a bare `Closes #N` outside every fence links an issue, and a reference inside a fence is inert — which is why a release body carries the same issues in two spellings and why that duplication must not be normalized.

## Bug Fixes

### The message validator measures the trailer across a blank line

The house format now separates the `Closes` line from the signoff with a blank line. The validator's footer scan stopped at that blank, so an over-long `Closes` line was measured against the body's 300-character cap instead of the footer's 100 — the diagnostic stayed silent and the commit-msg hook rejected the message afterwards, which is the exact failure the script exists to prevent.
