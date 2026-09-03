---
module: silk-effects
category: architecture
status: current
completeness: 90
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ./pr-body.md
  - ./commitlint.md
  - ./changesets.md
---

# Issue references

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Two dialects](#two-dialects)
- [The three call sites](#the-three-call-sites)
- [Behavior the kit fixes](#behavior-the-kit-fixes)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

GitHub issue-reference parsing — the closing keywords, the `#N` lists and the two dialects they appear in — is `@effected/github-references`. silk-effects holds no copy: PrBody's bare-line parser, commitlint's `closes-trailer` rule and the changesets reference harvester all call the kit, so one grammar answers for all three. Never re-hand-roll a keyword or `#N` pattern here.

## Current state

All three call sites are on the kit. `PrBody.ClosingReferences.BARE_LINE_PATTERN` no longer exists on the public surface; a consumer that reached for the regex calls `ClosingReferences.parseBare` (unchanged signature) or the kit directly.

## Two dialects

- The **line dialect** (`parseBareLines`, `parseClosingLists`, `parseReferenceLists`): the whole line, after trimming, must be `<keyword>[:] #N[, #N…]`. Colon-tolerant. A trailer is a line of its own, so a `#N` mentioned mid-prose never qualifies.
- The **inline dialect** (`harvestReferenceLists`): references harvested out of running text, no colon, several lists may share one line.
- `collectReferenceLists` composes them per line — whole-line parse first, inline harvest only for a line that is not a whole-line list — which guarantees a colon-less trailer contributes its list exactly once.

Which dialect a call site is on is a decision, not an accident.

## The three call sites

| Call site | Kit entry point | Dialect |
| --- | --- | --- |
| `PrBody.ClosingReferences.parseBare` (`src/pr-body/references.ts`) | `parseBareLines` | line, one `#N` per line |
| `Commitlint` `hasClosingTrailer` (`src/commitlint/hook/rules/closes-trailer.ts`) | `parseClosingLists` | line — a trailer must be its own line |
| `parseIssueReferences` (`src/changesets/utils/issue-refs.ts`, internal, reached through `getReleaseLine`) | `collectReferenceLists` + `keywordFamily` | both, per line |

## Behavior the kit fixes

The hand-rolled grammars had drifted from GitHub and from each other — three keyword sets, three separator rules, three answers to whether the `#` was optional. Adopting the kit corrected all of it; none of it is new policy:

- The keyword set is GitHub's nine closing tenses (`close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved`) plus the non-closing `ref`/`refs`/`references`.
- `closes-trailer` is strictly whole-line; a keyword in running prose no longer satisfies it. This is the intended reading of "trailer" and is documented at the call site so a future edit does not "fix" it back.
- `parseIssueReferences` requires the `#`, accumulates every list across the whole message in order (previously the first match per category only) and categorizes the `resolve` family as `closes` through a `Record<KeywordFamily, …>` that is total over the kit's family union — a family the kit adds without a category here is a type error, never a silent drop.
- Separators are the kit's: `,`, `and` and the Oxford `, and`. PrBody's bare-line separator is intra-line whitespace only.
- The old 10k-character input cap in `issue-refs.ts` is gone; the kit is regex-free and not backtracking-vulnerable, so there is no reason to ignore the tail of a long message.

Only the changesets side is user-visible output: a changeset whose body names issues in any of the recognized forms renders those refs in the changelog. The PrBody marker grammar (`Markers`, `Region`, `OwnedAttribute`) is untouched by all of this — it is a Silk contract, not GitHub's (see [PR body contract](./pr-body.md)).

## Rationale

### Why one grammar

Three parsers of the same GitHub syntax disagreeing with each other is exactly the failure a shared grammar removes, and GitHub's grammar carries no Silk opinion — it belongs in the kit, where every kit consumer gets the same answer.

## Related documentation

- [Architecture overview](./architecture.md)
- [PR body contract](./pr-body.md)
- [Commitlint namespace](./commitlint.md)
- [Changesets namespace](./changesets.md)
