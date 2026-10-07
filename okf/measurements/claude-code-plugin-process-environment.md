---
type: Measurement
title: What Claude Code passes to a plugin's monitors and the Bash tool (2.1.291/2.1.292)
description: "Measured 2026-10-06/07: a Claude Code monitor process runs in the project with none of CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA or CLAUDE_SESSION_ID, only CLAUDE_CODE_SESSION_ID; the Bash tool sees only CLAUDE_CODE_SESSION_ID plus the CLAUDE_ENV_FILE exports, and CLAUDE_CODE_SESSION_ID equals the hook session_id."
status: draft
tags: [tooling, compat]
stale_after: 2027-01-05T00:00:00Z
justifies:
  - ../decisions/adopt-pluginfinity-one-source-two-hosts.md
sources:
  - id: owner-brief
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
  - id: fidelity
    resource: ../measurements/claude-build-fidelity-against-legacy-plugin.md
  - id: resolver
    resource: ../../plugin/hooks/lib/silk/resolve-cli-project-dir.sh
generated:
  by: okfit/claude-code
  at: 2026-10-07T19:16:22Z
  body_sha256: 4a73b786301b95ec3db4770edcbd6de73f9c5ffd3cfd455dd8e647e47656bc4b
---

# What Claude Code passes to a plugin's monitors and the Bash tool (2.1.291/2.1.292)

## What was measured

Which Claude Code environment variables reach two kinds of plugin process that are not hooks: a background monitor started from `monitors/monitors.json`, and a command the model runs through the Bash tool, which is how a skill script runs. Measured live on 2026-10-06/07 during the pluginfinity dogfood rounds, on Claude Code 2.1.291 and 2.1.292, by printing the process's cwd and environment from a probe monitor and a probe Bash command.[^owner-brief]

## Results

| Variable or property | Monitor process (2.1.291, 2.1.292) | Bash tool (2.1.291) |
| :-- | :-- | :-- |
| cwd | the project | the caller's cwd |
| `CLAUDE_PROJECT_DIR` | absent | absent |
| `CLAUDE_PLUGIN_ROOT` | absent | absent |
| `CLAUDE_PLUGIN_DATA` | absent | absent |
| `CLAUDE_SESSION_ID` | absent | absent |
| `CLAUDE_CODE_SESSION_ID` | present | present, equal to the hook input's `session_id` |
| `CLAUDE_ENV_FILE` exports | not applied | applied |

The pluginfinity side measured the same on 2.1.292: `CLAUDE_ENV_FILE` is `~/.claude/session-env/<session>/sessionstart-hook-<n>.sh`, its exports reach the Bash tool but not later hooks, and a sibling `*hook*.sh` file in that directory reaches neither.[^owner-brief]

## What it ruled in and out

- **A monitor must find the project from its cwd**, and a skill script from its own `$0` and the caller's cwd. Neither can rely on `CLAUDE_PROJECT_DIR` or `CLAUDE_PLUGIN_ROOT`, so `plugin/`'s monitors and resolver scripts walk from those instead.[^fidelity]
- **Anything written to `CLAUDE_ENV_FILE` becomes ambient in every skill script.** `plugins/silk` wrote `SILK_PROJECT_DIR` there. `resolve-cli-project-dir.sh` then treated a set `SILK_PROJECT_DIR` as a deliberate override that beat the caller's cwd (it no longer does, since #706), so `commit.sh` was pinned to the session-start tree even when the agent worked in a worktree. `plugin/` stops declaring it.[^resolver]
- **`plugins/silk`'s `silk-hook.sh` reached hooks only because silk sourced it itself**, not through any host mechanism. pluginfinity's declared session env replaces it.
- **`CLAUDE_CODE_SESSION_ID` is the one stable session key outside hooks.** pluginfinity's `monitor_once` dedupe and the session-env project pointer key on it.

Re-measure on a Claude Code upgrade that mentions plugin, monitor or environment changes; a newly set variable would not break anything here, but a removed `CLAUDE_CODE_SESSION_ID` would.

[^owner-brief]: conversation with the repository owner
[^fidelity]: `../measurements/claude-build-fidelity-against-legacy-plugin.md`
[^resolver]: `../../plugin/hooks/lib/silk/resolve-cli-project-dir.sh`
