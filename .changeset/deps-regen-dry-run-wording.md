---
"@savvy-web/cli": patch
---

## Bug Fixes

### Dry-Run Dependency Regen Reports a Plan

`savvy changeset deps regen --dry-run` now reports `Would delete` and `Would write` instead of the `Deleted` and `Wrote` success lines of a real run, so a dry run no longer reads as if files changed. The `--json` output carries an explicit `dryRun` field in both modes.
