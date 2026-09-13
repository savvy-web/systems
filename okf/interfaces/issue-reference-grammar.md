---
type: Interface
title: Issue reference grammar
description: "The single GitHub closing-keyword and #N grammar every call site in this repo parses issue references with, so no two parsers disagree with each other or with GitHub."
status: draft
kind: api
resource: ../../packages/silk-effects/src/changesets/utils/issue-refs.ts
tags: [tooling, release]
sources:
  - id: issue-references-doc
    resource: ../../packages/silk-effects/src/changesets/utils/issue-refs.ts
  - id: pr-body-references
    resource: ../../packages/silk-core/src/pr-body/references.ts
  - id: closes-trailer
    resource: ../../packages/silk-effects/src/commitlint/hook/rules/closes-trailer.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 3ab85f2985079ac773fd4497e88230e78328eb7f012f0742c5cdf84190cd9d33
---

# Issue reference grammar

## What stays stable

GitHub issue-reference parsing — the closing keywords, the `#N` lists,
and the two dialects they appear in — is owned entirely by
`@effected/github-references`. Nothing under `packages/silk-core` or
`packages/silk-effects` holds its own copy of a keyword set or a `#N`
pattern; every call site delegates to the kit so all three answer the
same way for the same input.[^issue-references-doc]

- **The keyword set** is GitHub's nine closing tenses (`close`/`closes`/
  `closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved`) plus
  the non-closing `ref`/`refs`/`references`.[^issue-references-doc]
- **Two dialects, and which a call site uses is a decision, not an
  accident:**
  - the *line dialect* (kit's `parseBareLines` / `parseClosingLists` /
    `parseReferenceLists`) requires the whole line, after trimming, to
    be `<keyword>[:] #N[, #N…]`, colon-tolerant; a `#N` mentioned
    mid-prose never qualifies.
  - the *inline dialect* (kit's `harvestReferenceLists`) harvests
    references out of running text, no colon required, and several
    lists may share one line.
  - `collectReferenceLists` composes both — whole-line parse first,
    inline harvest only when a line is not itself a whole-line list —
    so a colon-less trailer contributes its list exactly once.[^issue-references-doc]
- **Separators** are the kit's: `,`, `and`, and the Oxford `, and`.
  `ClosingReferences.parseBare`'s line dialect is stricter still — its
  bare-line separator is intra-line whitespace only, one `#N` per
  line.[^issue-references-doc]
- **The three call sites in this repo, and the dialect each is
  contractually pinned to:**

  | Call site | Dialect |
  | --- | --- |
  | `ClosingReferences.parseBare` (`packages/silk-core/src/pr-body/references.ts`) | line, one `#N` per line |
  | `closes-trailer`'s `hasClosingTrailer` (`packages/silk-effects/src/commitlint/hook/rules/closes-trailer.ts`) | line — a trailer must be its own line; a keyword in running prose does not satisfy it |
  | `parseIssueReferences` (`packages/silk-effects/src/changesets/utils/issue-refs.ts`, reached through `getReleaseLine`) | both, per line, via `collectReferenceLists` |

  [^issue-references-doc]

- **A changeset's rendered references are the one user-visible output**
  of this grammar: a changeset body naming issues in any recognized form
  renders those references in the generated changelog. The `PrBody`
  marker grammar itself (`Markers`, `Region`, `OwnedAttribute`) is a
  separate, Silk-owned contract this grammar feeds into but does not
  define — see
  [pr-body-contract.md](pr-body-contract.md).[^issue-references-doc]
- `parseIssueReferences` requires the literal `#`, accumulates every
  list across the whole message in declared order (never just the first
  match per keyword family), and categorizes every `resolve`-family
  keyword under the `closes` category through a mapping that is total
  over the kit's keyword-family union — a family the kit adds without a
  mapped category here is a compile-time error, never a silent
  drop.[^issue-references-doc]

## Related

- [modules/silk-effects.md](../modules/silk-effects.md) — the module
  hosting `parseIssueReferences` and `closes-trailer`.
- [conventions/commit-and-pr-messages.md](../conventions/commit-and-pr-messages.md)
  — the authoring-side rules these parsers verify against.
- [pr-body-contract.md](pr-body-contract.md) — the marker contract that
  consumes `ClosingReferences.parseBare`.

[^issue-references-doc]: `../../packages/silk-effects/src/changesets/utils/issue-refs.ts`
