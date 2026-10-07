---
type: Measurement
title: Copilot reports SessionStart source new and gives an MCP server no project
description: "Measured by pluginfinity on Copilot CLI 1.0.92 (2026-10-07): a fresh session's SessionStart source is new, not startup, so a startup-matched hook never ran there; an MCP server starts at the plugin root with no roots capability and no project variable, so it cannot learn the project."
status: draft
tags: [tooling, compat]
stale_after: 2027-01-05T00:00:00Z
justifies:
  - ../decisions/adopt-pluginfinity-one-source-two-hosts.md
sources:
  - id: pluginfinity-probe
    resource: "pluginfinity dogfood round 3 status mail, 2026-10-07 (.claude/dogfood/pluginfinity-workspace/, gitignored)"
    last_modified: 2026-10-07T00:00:00Z
  - id: config
    resource: ../../plugin/pluginfinity.config.ts
  - id: hook-env
    resource: ../../plugin/hooks/lib/silk/hook-env.sh
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 451cf61d9cffc8df159c3aa95602e534dc7160481ca97c15f5328280f55ddb63
---

# Copilot reports SessionStart source new and gives an MCP server no project

## What was measured

Two host facts a GitHub Copilot plugin depends on, probed live by the pluginfinity maintainers on Copilot CLI 1.0.92 and reported to this repository during the 2026-10-07 dogfood round: the `source` a fresh session's SessionStart payload carries, and what an MCP server process can learn about the project it serves.[^pluginfinity-probe]

## Results

- **SessionStart `source` is `new` for a fresh session**, not `startup`. Copilot's payload `source` takes `startup`, `resume` or `new`.[^pluginfinity-probe]
- **A Copilot MCP server cannot learn the project.** Its cwd is the plugin root. The client advertises `sampling` and `elicitation` but not `roots`. Copilot sets no project variable (an `INIT_CWD` seen in the probe came from pnpm's launch script, not from Copilot). Claude Code, by contrast, advertises `roots` and returns the project plus every additional working directory.[^pluginfinity-probe]

## What it ruled in and out

- **`plugins/silk`'s `startup-only.sh` had never run on a fresh Copilot session**, since its `startup` matcher never matched. The Copilot build now widens a SessionStart `startup` matcher to `startup|new`, applied at run time.[^config]
- **savvy-mcp on Copilot always inspects the plugin root unless told otherwise.** `start-mcp.sh` finds no project there and falls back to `npx --yes @savvy-web/mcp`. The fix is on the caller's side: every savvy-mcp tool takes an optional `cwd`, and the Copilot orientation tells the model to always pass the project root. `silk_mcp_needs_cwd` decides that with `hook_supports server-project`, which fails on Copilot.[^hook-env]
- Whether the Copilot model actually follows that instruction has not been watched in a live session; see [copilot-plugin-host-gaps](../limitations/copilot-plugin-host-gaps.md).

Re-measure when Copilot CLI advertises `roots` or documents a project variable for plugin servers: either would let the `cwd` instruction go.

[^pluginfinity-probe]: pluginfinity dogfood round 3 status mail, 2026-10-07 (.claude/dogfood/pluginfinity-workspace/, gitignored)
[^config]: `../../plugin/pluginfinity.config.ts`
[^hook-env]: `../../plugin/hooks/lib/silk/hook-env.sh`
