---
type: Interface
title: PrBody contract
description: "The managed-region contract shared by every writer of a Silk PR description: what survives regeneration, the two closing-reference spellings, and the frozen silk-release marker grammar."
status: draft
kind: api
resource: ../../packages/silk-core/src/pr-body/index.ts
tags: [tooling, release]
sources:
  - id: pr-body-doc
    resource: ../../packages/silk-core/src/pr-body/index.ts
  - id: markers
    resource: ../../packages/silk-core/src/pr-body/markers.ts
  - id: references
    resource: ../../packages/silk-core/src/pr-body/references.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 3a4d5cfc842d07549b7b1cd60dbb715b68bc83f979cc6456e137a8a52c611dee
---

# PrBody contract

## What a consumer can rely on

`PrBody` (`packages/silk-core/src/pr-body/`, `export * as PrBody`) is the
managed PR-description contract shared between this repo's plugin skills
(via the `savvy` CLI) and `savvy-web/silk-release-action`. Two independent
writers edit the same PR bodies; this module is the one implementation
that keeps their output byte-identical, pinned by a fixture parity test
against the action's own `pr-body.ts`.[^pr-body-doc]

- A managed PR body has one outer region (`Markers.MANAGED_START` /
  `MANAGED_END`, wire name `silk-release`) that is regenerated wholesale
  on every run, and two nested regions that are NOT: a summary region
  (`silk-release:summary`) an AI summariser owns and the generating run
  never writes into, and a references region
  (`silk-release:references`) whose content the run reconciles rather
  than blindly overwrites.[^markers]
- **The `silk-release:` token names the contract, not the emitting
  action.** `silk-update-action` PRs carry the same markers as release
  PRs, deliberately — every live PR body, the plugin's `pr-body` skill,
  and every agent editing a managed description key on these exact byte
  sequences. Never parameterize the token per action and never rename
  it; either forks the wire format for zero benefit and orphans every
  open PR.[^pr-body-doc]
- Everything between `MANAGED_START`/`MANAGED_END` that is outside the
  summary and references regions is human territory and survives every
  regeneration untouched.[^markers]
- The proposed squash-commit block is fenced with the language
  `proposed-squash-commit` — not a GFM language, but GitHub renders it,
  and it is the target AI integrations read and rewrite into the
  eventual squash-commit message. Never "correct" it to `text`.[^markers]

## The two closing-reference spellings

The same issue ids appear twice in a managed body, spelled two different
ways, and **neither consumer accepts the other's spelling**:[^references]

- `ClosingReferences.renderTrailer()` — one comma-joined line
  (`Closes #1, #2`) inside the proposed-squash-commit fence, read by
  commitlint's `closes-trailer` rule.
- `ClosingReferences.renderBareLines()` — one bare `Closes #N` line per
  id, outside every fence, read by GitHub's own linker. A reference
  inside a fenced block is inert to GitHub.[^references]

`ClosingReferences.parseBare` reads the bare-line region back
(`@effected/github-references`' `parseBareLines`) so a prior run's own
references survive carry-through; see
[issue-reference-grammar](issue-reference-grammar.md) for the shared
grammar behind that parse. `OwnedAttribute` records, on the references
region's opening marker, which ids the previous run itself emitted — a
missing or malformed attribute degrades to treating everything in the
region as agent-authored (preserves too much, never deletes someone's
work) — and must never be hand-edited: a wrong value makes the next run
delete a real reference or resurrect a dropped one.[^references]

## Consumer surface

`packages/silk-core/src/pr-body/index.ts` is the whole public surface:
`Markers` (the frozen constants), `Region` (the generic begin/end pair
grammar), `ManagedPrBody` (build, upsert, extract summary and
references, with owned-id subtraction), `OwnedAttribute`,
`ClosingReferences`, `LinkedIssueRef` (whose `isClosed` is the only
sanctioned closedness test, case-insensitive so a GraphQL `CLOSED`
payload classifies the same as REST's `closed`) and the advisory
`PrBodyDiagnostic.scan`. Every function is total: malformed input
degrades fail-safe rather than throwing.[^pr-body-doc]

## Related

- [modules/silk-core.md](../modules/silk-core.md) — the module this
  contract lives in.
- [conventions/commit-and-pr-messages.md](../conventions/commit-and-pr-messages.md)
  — the authoring-side rules for commit and PR text.
- [issue-reference-grammar.md](issue-reference-grammar.md) — the shared
  GitHub reference grammar `ClosingReferences.parseBare` delegates to.

[^pr-body-doc]: `../../packages/silk-core/src/pr-body/index.ts`
[^markers]: ../../packages/silk-core/src/pr-body/markers.ts
[^references]: ../../packages/silk-core/src/pr-body/references.ts
