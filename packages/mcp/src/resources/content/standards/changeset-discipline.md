---
id: standards/changeset-discipline
title: Changeset discipline
summary: Load when deciding whether a branch needs a changeset and how to author one.
tier: standards
source: hand
tags: [changeset, release]
priority: 0.8
related: [packages/silk-effects/, standards/publishability]
---

## Rule

Every branch that changes a publishable package's runtime behavior, public API, or
shipped output ships a changeset that describes the change in user-facing terms.
Changes that do not affect what a consumer installs — AI context files, design
docs, internal tests, trivial config — do not get a changeset. The Silk ecosystem
formats changelogs through `@savvy-web/changesets`, a section-aware formatter that
categorizes entries with `h2`/`h3` headings (Features, Bug Fixes, Breaking Changes,
and the rest of the 13 valid headings) and enriches them with PR links and
contributor attribution.

## Why

A changeset is release documentation, not a commit log. It answers "what changed
for someone consuming this package" one level above the diff. Reconciling the
changeset set against the branch diff before merge keeps the `.changeset/`
directory an accurate description of the pending release: stale entries that name
packages no longer touched are removed, and missing entries for shipped work are
added. Pure dependency bumps follow a one-package-per-changeset, one-dependency-
changeset-per-package convention so the changelog reads cleanly.

A config is detected as Silk (versus vanilla changesets) when its `changelog`
field references `@savvy-web/changesets`; Silk mode is what enables the
section-aware pipeline and the ignore-aware publishability rules.

## Examples

A `feat` that adds a public export needs a `minor` changeset under a Features
heading. A `fix` that corrects shipped behavior needs a `patch` changeset under
Bug Fixes. A branch that only edits `CLAUDE.md` and `.claude/design/` needs no
changeset. A breaking signature change needs a `major` changeset under Breaking
Changes.

## See also

Authoring and reconciliation are handled by the changeset skills — the
`changeset-create` skill reconciles changesets against the branch diff, and the
`changeset-style` skill carries the full format spec (the 13 headings and rules
CSH001–CSH005). The publishability rules that decide which packages a changeset
may name live at `silk://standards/publishability`; the config reader and the
fixed/ignore groups it exposes are documented at `silk://packages/silk-effects/`.
