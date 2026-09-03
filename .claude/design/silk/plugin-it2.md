---
status: current
module: silk
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./plugin.md
  - ./plugin-hooks.md
  - ./plugin-dogfood.md
dependencies: []
---

# plugins/silk — it2 pane-orchestration capability

The [silk plugin](./plugin.md)'s lightest capability: it teaches the agent to orchestrate iTerm2 panes and windows for the subagents it spawns, via the separately installed `it2` CLI. Same *gated orientation nudge + point-of-use skill* shape as the other capabilities, but with no agent, MCP tool, hook or guard.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The gated orientation block](#the-gated-orientation-block)
- [The it2 skill](#the-it2-skill)
- [Relationship to dogfood](#relationship-to-dogfood)
- [Rationale](#rationale)

## Overview

The pieces: `skills/it2/SKILL.md` and the `<terminal>` sub-block in `hooks/session-start/orientation.sh`. Nothing else in the plugin calls it2 except the dogfood skill's optional transport.

## Current State

Implemented. The gate and the skill ship as described; `tests/session-start-orientation.bats` pins when the block renders.

## The gated orientation block

The `<terminal>` sub-block of the `<silk_capabilities>` payload (`hooks/session-start/orientation.sh`, see [plugin-hooks.md](./plugin-hooks.md#the-orientation-payload)) renders only when an env-only gate holds: `TERM_PROGRAM == "iTerm.app"` or `LC_TERMINAL == "iTerm2"`, AND `it2` on `PATH`. The gate is deliberately **prompt-free** — no it2 subprocess — because the hook fires on every resume and compact and any it2 call risks its first-use iTerm2 API-authorization dialog or a hang. A false positive (it2 installed, API not yet authorized) self-corrects at the first point-of-use call; a false negative (iTerm2 not exporting `TERM_PROGRAM` under some SSH/tmux nesting) is a missed nudge, never a broken session. The block is index-shaped — split and badge a pane per subagent, keep the user's windows legible, dismiss-and-close subagents you no longer need — and points at `/silk:it2` for depth. The hook body avoids apostrophes on purpose; its comment explains the bash 3.2 heredoc bug that forces it.

## The it2 skill

`skills/it2/SKILL.md` (`/silk:it2`, description-triggered, no `paths` trigger since it has no backing file) is the self-contained playbook over the raw `it2` CLI; it does not depend on the external `it2-skills` marketplace plugin. It pins the split-direction semantics that get inverted routinely, a geometry-driven layout heuristic, point-of-use geometry queries, grid recipes, the session-id-prefix badging convention, the dismiss-and-close discipline and a "when NOT to orchestrate" guardrail so proactive never becomes intrusive. Every it2 call and geometry query happens at point-of-use, never in a hook.

## Relationship to dogfood

The [dogfood capability](./plugin-dogfood.md) uses it2 as a cross-session *doorbell/spawn transport*; this capability uses it as a *pane-layout tool for subagents* — same CLI, different job. Both decline it2's auto-approve/modal plugins: cross-session auto-approval is permission laundering, and approvals stay with the human in each session.

## Rationale

Pane orchestration is only useful in one terminal, so the nudge is gated rather than always-on, and gated by environment rather than by probing it2 so a hook that fires on every resume can never block on a dialog. Everything that actually touches it2 lives in the skill at point-of-use, where an authorization prompt is a normal thing to surface to the user.
