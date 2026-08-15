---
"@savvy-web/silk-effects": minor
---

## Features

### PrBody namespace — the shared PR-body contract

New `PrBody` namespace owning the `silk-release` marker contract dogfooded in `silk-release-action`, so independent writers of a managed PR description share one implementation. All operations are pure and total, and output is byte-compatible with the action's `pr-body.ts`, pinned by fixtures generated from the original implementation.

* `Markers` — the frozen `silk-release` marker constants and the `proposed-squash-commit` fence language; the single source of truth for the marker grammar
* `Region` — the generic marker-pair region grammar: `start`, `end`, `read`, `strip`, `upsert`
* `ManagedPrBody` — `build`, `upsert`, `extractSummary`, `extractReferences`: the managed-body renderer with summary and reference carry-through and owned-id subtraction
* `ClosingReferences` — one owner for the two closing-reference spellings: the comma-joined commitlint trailer and the bare one-per-line form GitHub's linker reads
* `LinkedIssueRef` — the issue shape with `isClosed`, the case-insensitive closedness test that classifies REST `closed` and GraphQL `CLOSED` alike
* `OwnedAttribute` — render and parse for the references marker's owned-ids attribute
* `PrBodyDiagnostic` — advisory `scan` reporting unpaired or duplicated markers
