---
id: standards/commit-contract
title: Silk commit contract
summary: Load when composing any conventional commit, amending, squashing, or opening a PR.
tier: standards
source: hand
tags: [commit, dco, tdd]
priority: 0.8
related: [standards/changeset-discipline]
---

## Rule

Commits follow `type(scope): subject`, with an optional body, optional `Closes #N`
trailers, and a mandatory DCO `Signed-off-by` trailer as the last line. The
`@savvy-web/commitlint` Silk preset enforces this through the `commit-msg` husky
hook; violations reject the commit.

**Type enum** (one lowercase identifier): `ai`, `build`, `chore`, `ci`, `docs`,
`feat`, `fix`, `perf`, `refactor`, `release`, `revert`, `style`, `tdd`, `test`.
Do not invent types.

**Subject:** imperative mood ("add", not "added"/"adds"); lowercase first letter
after the colon; the full header at most 100 characters; no trailing period; no
markdown.

**Body** (optional): explain what changed conceptually and why, one level above
the diff. Each paragraph or bullet is one continuous line — do not soft-wrap.
No markdown headers, numbered lists, code fences, links, bold, or italic. Name
the concept that changed, not every file. For dependency updates list only direct
deps, never transitive lockfile entries. Skip routine AI-context and config tweaks.

## Why

`tdd` commits require a structured scope `goalId:state` matching
`^\d+:(spike|red|green|refactor)$` — for example `tdd(42:red)` or `tdd(7:green)`.
The scope ties a commit to a TDD goal and its phase, so a bare `tdd` or
`tdd(red)` is rejected. The DCO signoff is the Developer Certificate of Origin
attestation; its exact `Signed-off-by: Full Name <email>` form is required
verbatim, using the committer's real name and git email. When `commit.gpgsign`
is true, confirm the signing agent is responsive rather than silently producing
an unsigned commit.

## Examples

Good: `feat(auth): add JWT refresh token rotation`. Bad: `feat: Updated the auth
flow` (past tense, capitalized, vague).

A TDD green-phase commit: `tdd(14:green): implement scope validator for tdd commits`.

A fix that closes an issue carries `Closes #87` above the signoff. Any of
`Closes`, `Fixes`, or `Resolves` followed by `#N` is accepted, one trailer per
issue.

## See also

The commit-create skill carries the full pre-commit checklist and worked examples.
Release documentation discipline lives at `silk://standards/changeset-discipline`.
