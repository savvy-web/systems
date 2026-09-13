---
type: Convention
title: Run Biome only through biome_check or the three sanctioned root scripts
description: "Direct Biome invocation (bare, path-prefixed, npx/bunx/dlx, pnpm exec, sudo/env-wrapped) is denied by biome-direct-deny because it skips this repo's config and can corrupt read-only .repos/** vendored submodules; use mcp__plugin_silk_savvy-mcp__biome_check or pnpm lint / lint:fix / lint:fix:unsafe."
stale_after: 2027-03-12T00:00:00-04:00
tags: [tooling, security]
sources:
  - id: plugin-biome
    resource: ../../plugins/silk/hooks/pre-tool-use/biome-direct-deny.sh
  - id: claude-md
    resource: ../../CLAUDE.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: aff8ae928638b6984b13d1e0b8d26315a54b3138b11960a35c09687400ee9a5c
---

# Run Biome only through biome_check or the three sanctioned root scripts

Reach Biome through one of three channels the [silk-plugin](../modules/silk-plugin.md) wires, each suited to a different intent: the Biome LSP for automatic in-loop diagnostics (feedback only, cannot apply fixes), the `mcp__plugin_silk_savvy-mcp__biome_check` MCP tool for structured execution with fixes (see [savvy-mcp-tools](../interfaces/savvy-mcp-tools.md)), or one of the three sanctioned root scripts — `pnpm lint`, `pnpm lint:fix`, `pnpm lint:fix:unsafe` — run through any package manager. Every other Bash route is denied.[^plugin-biome]

## Why direct invocation is denied, not merely nudged

`biome-direct-deny` denies every command that directly reaches the Biome binary: bare, path-prefixed, `exec`, `npx`/`bunx`/`dlx`, `pnpm exec`, `sudo`/`env`-wrapped, or the scoped `@biomejs/biome` package — with the three sanctioned scripts as the only exception. The reason is corruption, not tidiness: a direct invocation does not resolve this repo's Biome config, so it walks into `.repos/**` read-only vendored submodules and can corrupt them or die on `EACCES`. Package-manager SCRIPTS are left alone regardless of name (`pnpm --filter <pkg> lint`, `pnpm -r lint`, `turbo run lint`) because a script invocation resolves `package.json` before anything runs, so it always carries the repo's config.[^plugin-biome]

Never work around this hook or "fix" a config-resolution error it surfaces by editing the Biome config — see the transient-race note below.

## `npx biome` is a false green

`npx biome` resolves to an unrelated npm package (`0.3.3`) that no-ops and exits 0 — it does not run real Biome and does not check anything, even though the command reports success. Real Biome prints `Version: 2.5.9`. This makes the bare/npx route not just denied but actively misleading if it were ever allowed to run.[^claude-md]

## The resolve-configuration race is transient, not a config bug

`pnpm lint` (and the other sanctioned scripts) can fail transiently with `Failed to resolve the configuration from @savvy-web/silk/biome` while silk's `dist/dev` is mid-rebuild (see [workspace-prepare-scripts](workspace-prepare-scripts.md)). This is the known rebuild race — retry rather than editing the Biome config.[^claude-md]

## The nudge is separate from the deny

`biome-prefer-mcp` detects Biome run through Bash — directly or via a package-manager/turbo script whose nearest `package.json` mentions `biome` — and emits a once-per-session nudge toward `biome_check`. It emits no `permissionDecision`, so it never blocks; the deny hook's decision is authoritative on the same command. The nudge is suppressed inside a dispatched subagent (no `biome_check` tool there means the nudge would be a dead end), and it matches only when "biome" is the first token of a control-operator-delimited segment, not when it appears later in an argument or inside quoted prose.[^plugin-biome]

[^plugin-biome]: `../../plugins/silk/hooks/pre-tool-use/biome-direct-deny.sh` — the deny hook; its nudge counterpart is `biome-prefer-mcp.sh` in the same directory
[^claude-md]: [CLAUDE.md](../../CLAUDE.md), "Key Commands"
