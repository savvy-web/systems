---
type: Gotcha
status: deprecated
title: The it2 dogfood doorbell's --retry delivers the notice several times
description: "it2 session send-text --retry 3 reports 'Text not delivered' against a Claude Code session even when the text landed, so the dogfood doorbell types the same notice into the counterpart up to four times while reporting success only on the last attempt (savvy-web/systems#755, fixed: the doorbell now sends once with --skip-confirm)."
resource: ../../plugin/skills/dogfood/SKILL.md
tags: [tooling, dx]
stale_after: 2027-01-05T00:00:00Z
sources:
  - id: issue
    resource: https://github.com/savvy-web/systems/issues/755
  - id: dogfood-skill
    resource: ../../plugin/skills/dogfood/SKILL.md
generated:
  by: okfit/claude-code
  at: 2026-11-21T01:24:11Z
x-okfit-integrity:
  generated:
    body: 5980ac072a3ec0ac
---

# The it2 dogfood doorbell's --retry delivers the notice several times

> **Deprecated.** savvy-web/systems#755 is fixed: the dogfood skill now rings the doorbell once with `it2 session send-text <id> --skip-confirm` and no `--retry`, and a receiver ignores a doorbell naming mail already recorded as `lastMail.in`.[^dogfood-skill] Kept for history.

## What you see

During a dogfood loop, the counterpart's doorbell notice (`dogfood mail: <kind> round <n> — <path>`) arrives in your session two to six times for one mail. On the sending side, it2 reports `✓ Text delivered successfully (after 4 attempt(s))`.[^issue]

## What you will wrongly conclude

That the first three attempts were dropped and the fourth delivered, so `--retry 3` is necessary. That is how the dogfood skill read it before the fix: it said `--retry 3` was required because idle sessions fail the first attempts.

## What is actually true

`it2 session send-text` confirms delivery by looking for a shell-style echo on screen. A Claude Code TUI input box produces none, so every attempt that did type the text is reported as `Text not delivered` (exit 3), and `--retry` types it again. "Succeeds on the 4th try" is more likely four deliveries and three false negatives. Seen on 2026-10-06 in the savvy-web-systems ⇄ pluginfinity-workspace loop.[^issue]

The duplicates are noise, not data loss: the file mailbox is the source of truth and the `dogfood-mail` monitor backstops a missed doorbell. Read the mail file once, however many doorbells announced it. The fix sends once with `--skip-confirm`, which drops the echo check entirely.[^issue]

[^issue]: <https://github.com/savvy-web/systems/issues/755>
[^dogfood-skill]: `../../plugin/skills/dogfood/SKILL.md`
