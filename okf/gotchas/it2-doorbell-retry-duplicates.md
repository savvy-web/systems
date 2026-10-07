---
type: Gotcha
status: draft
title: The it2 dogfood doorbell's --retry delivers the notice several times
description: "it2 session send-text --retry 3 reports 'Text not delivered' against a Claude Code session even when the text landed, so the dogfood doorbell types the same notice into the counterpart up to four times while reporting success only on the last attempt (savvy-web/systems#755, open)."
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
  at: 2026-10-07T16:26:44Z
  body_sha256: 767542a68aeb436b4576573d87075c7440f720adc0a08b91627fad54273feeab
---

# The it2 dogfood doorbell's --retry delivers the notice several times

## What you see

During a dogfood loop, the counterpart's doorbell notice (`dogfood mail: <kind> round <n> — <path>`) arrives in your session two to six times for one mail. On the sending side, it2 reports `✓ Text delivered successfully (after 4 attempt(s))`.[^issue]

## What you will wrongly conclude

That the first three attempts were dropped and the fourth delivered, so `--retry 3` is necessary. That is how the dogfood skill reads it today: it says `--retry 3` is required because idle sessions fail the first attempts.[^dogfood-skill]

## What is actually true

`it2 session send-text` confirms delivery by looking for a shell-style echo on screen. A Claude Code TUI input box produces none, so every attempt that did type the text is reported as `Text not delivered` (exit 3), and `--retry` types it again. "Succeeds on the 4th try" is more likely four deliveries and three false negatives. Seen on 2026-10-06 in the savvy-web-systems ⇄ pluginfinity-workspace loop.[^issue]

The duplicates are noise, not data loss: the file mailbox is the source of truth and the `dogfood-mail` monitor backstops a missed doorbell. Read the mail file once, however many doorbells announced it. The open fix is to send once with no `--retry`, or to keep it with `--require has-no-partial-input`; either needs a check against a live Claude Code pane before the skill changes. Deprecate this concept once savvy-web/systems#755 lands in `plugin/skills/dogfood/SKILL.md`.[^issue]

[^issue]: <https://github.com/savvy-web/systems/issues/755>
[^dogfood-skill]: `../../plugin/skills/dogfood/SKILL.md`
