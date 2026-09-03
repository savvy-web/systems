---
module: silk-effects
category: architecture
status: current
completeness: 85
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ./issue-references.md
  - ../silk/plugin.md
---

# PR body contract

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The frozen marker grammar](#the-frozen-marker-grammar)
- [Surface](#surface)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`PrBody` (`src/pr-body/`, `export * as PrBody`) is the managed PR-description contract shared with `savvy-web/silk-release-action`: the marker grammar that delimits the tool-owned region of a PR body, the region carry-through that preserves human-authored summary and references across regenerations and the two closing-reference spellings. The consumer-side half of the same contract is the silk plugin's `pr-body` skill (`../silk/plugin.md`).

## Current state

Implemented and pure. Byte-parity with the action's `pr-body.ts` is pinned by `__test__/fixtures/pr-body/expected.json` (`__test__/pr-body/parity.test.ts`), and `__test__/pr-body/skill-sync.test.ts` drift-lints the plugin skills against the exported literals.

## The frozen marker grammar

**The `silk-release:` token names the contract, not the emitting action.** `silk-update-action` PRs carry the same markers as release PRs, deliberately: every live PR body, the `pr-body` skill and every agent that edits a managed description key on these exact byte sequences. Do not parameterize the token per action and do not rename it — either forks the wire format for zero gain and orphans every open PR. `markers.ts` is the single source of truth; the plugin skills duplicate the literals for readability and the drift lint keeps the copies in sync.

## Surface

`src/pr-body/index.ts` lists it: `Markers` (the constants), `Region` (the generic begin/end pair grammar), `ManagedPrBody` (build, upsert, extract summary and references, with owned-id subtraction), `OwnedAttribute`, `ClosingReferences` (the comma-joined trailer spelling for commitlint and the bare per-line spelling for GitHub's linker — neither consumer accepts the other's), `LinkedIssueRef` (whose `isClosed` is the only sanctioned closedness test, case-insensitive so GraphQL `CLOSED` classifies) and the advisory `PrBodyDiagnostic.scan`. Everything is total: malformed input degrades fail-safe rather than failing.

Reference parsing delegates to the kit grammar — see [Issue references](./issue-references.md).

## Rationale

### Why the contract lives here

Two independent writers (the release action and the plugin skill via the CLI) edit the same PR bodies. One implementation with a parity fixture is the only way to keep their outputs byte-identical; the action depends on silk-effects, so this is the shared home.

## Related documentation

- [Architecture overview](./architecture.md)
- [Issue references](./issue-references.md)
- [`../silk/plugin.md`](../silk/plugin.md) — the `pr-body` skill
