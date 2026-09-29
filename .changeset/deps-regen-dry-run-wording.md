---
"@savvy-web/cli": patch
---

## Bug Fixes

### Dry-Run Dependency Regen Reports a Plan

`savvy changeset deps regen --dry-run` now reports `Would delete` and `Would write` instead of the `Deleted` and `Wrote` success lines of a real run, so a dry run no longer reads as if files changed. The `--json` output carries an explicit `dryRun` field in both modes.

### Real-Run Dependency Regen Reports What Happened

A real `savvy changeset deps regen` run now reports the files `execute` actually deleted and wrote, not the plan's lists. A planned deletion whose file was already gone is reported as such instead of being counted as deleted, and `--json` adds the `result` of the run.
