---
type: Gotcha
status: draft
title: pkill on a monitor script name kills every session's monitor
description: "Every Claude Code session runs its own copy of the silk monitors from the same plugin path, so pkill -f watch-issues.mjs (or any monitor file name) stops the monitor in every open session, not just the one being debugged, and the others go quiet without saying so."
resource: ../../plugin/monitors
tags: [tooling, dx]
stale_after: 2027-01-05T00:00:00Z
sources:
  - id: owner-brief
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
  - id: config
    resource: ../../plugin/pluginfinity.config.ts
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: aa375c1240852de42f52d275cae6a3f25eb18f2290ae5a8c9d875ff402180b37
---

# pkill on a monitor script name kills every session's monitor

## What you see

You restart a misbehaving silk monitor (`tsdoc-diagnostics`, `dogfood-mail` or `gitmodules-drift`) with `pkill -f watch-issues.mjs`, `pkill -f dogfood-mail.mjs` or similar. The command succeeds, and the current session's monitor is gone as expected.[^owner-brief]

## What you will wrongly conclude

That you stopped one process, the monitor belonging to this session.

## What is actually true

Claude Code starts each monitor once per session, with the command `node "${CLAUDE_PLUGIN_ROOT}/monitors/<file>.mjs"`.[^config] Every session that has the plugin installed runs the same script from the same plugin cache path, so the command line matches in all of them and `pkill -f` kills them all. The other sessions stop receiving build-diagnostic, dogfood-mail or drift notifications, and the most they see is Claude Code's one-line background-task notice that the monitor ended (exit 0), which reads like a normal shutdown. Nothing restarts it. Parallel agent sessions in one checkout are normal here, so this silences real work.[^owner-brief]

Kill a monitor by its pid instead, after confirming its parent is the session you mean (`ps -o pid,ppid,command`), or restart the session.

[^owner-brief]: conversation with the repository owner
[^config]: `../../plugin/pluginfinity.config.ts`
