---
type: Gotcha
status: draft
title: markdownlint --fix renumbers a list split by a column-0 host-block marker
description: "A pluginfinity host-block marker at column 0 inside an ordered list ends the list, so the pre-commit markdownlint --fix pass renumbers the following items and dedents their sub-bullets; the skill still builds and reads fine until the rendered numbering is compared with the original."
resource: ../../lib/configs/lint-staged.config.ts
tags: [tooling, dx]
stale_after: 2027-01-05T00:00:00Z
sources:
  - id: authoring
    resource: ../conventions/plugin-authoring.md
  - id: lint-staged
    resource: ../../lib/configs/lint-staged.config.ts
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:43:24Z
  body_sha256: c09481e846c1b7016761faa254817ce1ecabf5ae4470fd69f719895c4597b4e1
---

# markdownlint --fix renumbers a list split by a column-0 host-block marker

## What you see

A skill or agent under `plugin/skills` or `plugin/agents` has an ordered list with one item wrapped in a pluginfinity host block. After a commit, the Claude build renders `1.` where the original said `4.`, or later sub-bullets have lost their indent. The build passes, `pluginfinity validate` passes, and markdownlint reports nothing.[^authoring]

## What you will wrongly conclude

That pluginfinity's host-block rendering or the Claude build broke the numbering, or that the source was always like that.

## What is actually true

lint-staged runs `markdownlint-cli2 --fix` on every staged `*.md`.[^lint-staged] A host-block marker at column 0 ends a Markdown list, so MD029 and MD007 see a new list after it and "fix" its numbering and indentation in the source. That is how round 1's `commit-create` came to render `1.` where the retired `plugins/silk` had `4.`, and a fix pass rewrote `config` and `changeset-manager` the same way before they were restored.[^authoring]

Indent a marker inside a list to the item's content column (3 spaces for `1.`); pluginfinity accepts and strips it there. Where a whole item has two host versions, the two alternative items still look like a duplicate number to MD029, so put the markdownlint disable comment in the Copilot block only (`disable-next-line` for a last item, `disable-file MD029` otherwise). The Claude build stays free of those comments.[^authoring]

`plugin/builds/**` is excluded from markdownlint, so the trap is in the source, never the builds.

[^authoring]: `../conventions/plugin-authoring.md`
[^lint-staged]: `../../lib/configs/lint-staged.config.ts`
