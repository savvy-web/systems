---
"@savvy-web/cli": minor
---

## Breaking Changes

`savvy repos status --json` no longer includes a `commit` field per repo. The payload already reported the gitlink as a staged/committed/checked-out triple; only the deprecated alias is gone. Read `stagedCommit` instead — a script that parsed `.repos[].commit` out of the JSON output needs to switch to `.repos[].stagedCommit`.

## Bug Fixes

`savvy repos restore` reports any repo whose worktree is still dirty after the reset and exits 1, rather than reporting a reset that achieved nothing as success.

## Features

`savvy repos remove` prints the removed entry's orientation block when it has one. `savvy repos add` does not restore it on its own, so a re-vendor loses it unless it is captured at removal time.
