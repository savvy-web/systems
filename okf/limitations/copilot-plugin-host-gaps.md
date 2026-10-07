---
type: Limitation
title: The Copilot build of silk drops context nudges, monitors and project discovery
description: "On GitHub Copilot the silk plugin's denies work, but PreToolUse advice, the Stop changeset nudge, the monitors and the it2 skill do not exist, savvy-mcp cannot learn the project, and session values never reach the model's shell."
status: draft
bounds: ../modules/silk-plugin.md
tags: [tooling, compat]
sources:
  - id: copilot-build
    resource: ../../plugin/builds/copilot
  - id: config
    resource: ../../plugin/pluginfinity.config.ts
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 50394910c9a3736b7e753f2ac8b3c2892647b44672ff3ac9b321aa397d7aa076
---

# The Copilot build of silk drops context nudges, monitors and project discovery

This bounds [silk-plugin](../modules/silk-plugin.md) on GitHub Copilot. The Claude Code build is unaffected by everything below.

## What does not work, and what a Copilot user sees

- **PreToolUse context is ignored.** Copilot honours no `additionalContext` on PreToolUse, so the `biome-prefer-mcp` nudge, the dogfood-guard "loop still open" advisory, and pre-commit-message advice that is not a deny are silent. Every deny still works. The build reports each one as a `hook-output-ignored` note.[^copilot-build]
- **The Stop changeset nudge never appears.** It is a `systemMessage`, and Copilot has none.[^copilot-build]
- **No monitors.** Copilot has no monitor mechanism, so the build omits `tsdoc-diagnostics`, `dogfood-mail` and `gitmodules-drift` (three `monitor-omitted` notes). Drift and new dogfood mail are found only by asking.[^config]
- **No `it2` skill**, which is Claude-only (`targets: { copilot: false }`). The dogfood skill still describes its optional it2 transport and the dogfood-mail monitor on Copilot.[^copilot-build]
- **savvy-mcp inspects the plugin root unless the model passes `cwd`.** Copilot gives an MCP server no project (see [copilot-plugin-host-environment](../measurements/copilot-plugin-host-environment.md)). The orientation tells the model to pass the project root as `cwd` to every tool; a call that omits it reads the wrong tree.[^copilot-build]
- **Session values reach hooks and `list.sh`, not the model's shell.** Copilot has no `CLAUDE_ENV_FILE`, so a command the model runs by hand does not see `SILK_PACKAGE_MANAGER` (the `env-shell-unsupported` note).[^copilot-build]
- **Agent and skill tool grants are wider.** Copilot has no per-command Bash rules, so `Bash(git *)`-style grants become a whole-`Bash` grant.[^copilot-build]

## Why that is acceptable

Every gap is a missing host capability, not a silk defect, and none weakens a guard: the fail-closed denies hold on both hosts. The Claude build, which most users run, keeps full fidelity.

## Not yet verified live

These are pluginfinity's documented assumptions, not observations: whether Copilot reports other servers' MCP tools under the `mcp__github…`/`mcp__gk…` names the `commit-mcp`, `repos-mcp-guard` and `dogfood-guard` matchers expect; whether a Copilot model substitutes the `<skill base directory>` placeholder `{{skill_dir}}` renders; whether it follows the `cwd` instruction; and whether Copilot hook input always carries an absolute `cwd`. Each needs a live Copilot session to settle.[^copilot-build]

[^copilot-build]: `../../plugin/builds/copilot`
[^config]: `../../plugin/pluginfinity.config.ts`
