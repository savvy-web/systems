---
"@savvy-web/mcp": minor
---

## Features

Adds a changeset_preview tool that previews the next release using the real
changeset engine, and refactors savvy changeset version onto the native
ReleasePlanner apply so it no longer shells out to an installed changeset
binary. The silk plugin changeset-preview skill renders from the new tool.

This bumps the cli and silk packages in lockstep through the fixed changeset
group. Note a behavior change to savvy changeset version: the dry-run flag is
now a true no-write report of the planned release, where it previously delegated
to the changeset binary.
