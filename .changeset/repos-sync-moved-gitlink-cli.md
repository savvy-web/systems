---
"@savvy-web/cli": patch
"@savvy-web/mcp": patch
---

## Bug Fixes

- `savvy repos sync` prints a line for each repo it advanced onto a moved gitlink and a warning for each dirty repo it left behind, with a `savvy repos restore` hint. Either case suppresses the "all vendored repos up to date" line. The `repos_manage` sync result carries the new `advanced` and `skippedDirty` fields.
- `savvy repos sync` and `savvy repos pin` work from a linked git worktree.
