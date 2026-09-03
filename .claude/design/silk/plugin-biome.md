---
status: current
module: silk
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./plugin.md
  - ./plugin-hooks.md
  - ./plugin-repos.md
  - ./architecture.md
  - ../mcp/architecture.md
dependencies: []
---

# plugins/silk — Biome capability

The [silk plugin](./plugin.md) gives the agent three channels onto Biome, each suited to a different intent: automatic in-loop feedback (the LSP), on-demand structured execution with fixes (the `biome_check` MCP tool) and a narrowly sanctioned Bash path. Everything else is denied. The plugin only wires connections — both the LSP and the MCP proxy need Biome on `PATH` or resolvable from the project; neither bundles the binary.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The three channels](#the-three-channels)
- [biome-direct-deny: deny, not nudge](#biome-direct-deny-deny-not-nudge)
- [biome-prefer-mcp: nudge, never block](#biome-prefer-mcp-nudge-never-block)
- [Shared segmentation](#shared-segmentation)
- [Rationale](#rationale)

## Overview

The pieces: the `lspServers.biome` block in `plugin.json` with `bin/biome-lsp.sh`, the `biome_check` tool on `savvy-mcp`, and two PreToolUse hooks on `Bash` — `biome-prefer-mcp.sh` (nudge) and `biome-direct-deny.sh` (deny) — sharing `hooks/lib/split-segments.sh`.

## Current State

Implemented. The deny hook is the current incarnation (it superseded a narrower `npx`/`bunx`-only deny); the hook headers and `tests/pre-tool-use-biome-*.bats` are authoritative for exactly which command shapes deny, nudge or pass.

## The three channels

- **The LSP — automatic diagnostics.** The `lspServers.biome` block in `plugin.json` launches `biome lsp-proxy` through `bin/biome-lsp.sh`, so lint/format diagnostics on the file the agent just edited land in context with zero prompting. The launcher mirrors `Lint.Biome`'s discovery order — global `biome` first, then a walk-up for project-local `node_modules/.bin/biome` — and exits with an actionable stderr message instead of a bare "executable not found". The LSP is diagnostics-only: it sees open/edited files, not the whole repo, and cannot apply fixes.
- **`biome_check` — structured execution with fixes.** The `savvy-mcp` tool runs Biome over a path and returns parsed diagnostics, with read-only check plus safe and unsafe fix modes. It is the channel for "I want a structured result or want to apply fixes", and the first mutating savvy-mcp tool (`../mcp/architecture.md`).
- **Bash — three sanctioned scripts only.** `lint` / `lint:fix` / `lint:fix:unsafe` run through any of pnpm/yarn/bun/npm, bare or `run`-prefixed. Every other Bash route is denied. The `<biome>` block in the orientation payload states this division of labor; the fuller teaching, including never running Biome just to look, lives in `startup-only.sh`'s `<running_tools>` block.

## biome-direct-deny: deny, not nudge

`hooks/pre-tool-use/biome-direct-deny.sh` (`matcher: "Bash"`) denies every command that **directly reaches the Biome binary** — bare, path-prefixed, `exec`, `npx`/`bunx`/`dlx`, `pnpm exec`, `sudo`/`env`-wrapped, the scoped `@biomejs/biome` package — except the three sanctioned scripts. The load-bearing reason is corruption, not tidiness: a direct invocation does not resolve the repo's config (`packages/silk/public/biome/silk.json` excludes `.repos` and `.claude/worktrees`, which the root config extends), so it walks into `.repos/**` read-only vendored submodules and can corrupt them or die on `EACCES`. Package-manager **scripts** are left alone entirely, sanctioned name or not (`pnpm --filter <pkg> lint`, `pnpm -r lint`, `turbo run lint`): a script invocation resolves `package.json` before anything runs, so it always carries the repo's config.

The rule is one rule, no exception, no heuristic — deny only what is syntactically verifiable as reaching the binary. A version that also denied unrecognized script names was removed: judging what a script's body invokes needs `package.json` and turbo-graph resolution the hook does not have, and an approximate DENY is worse than an approximate nudge because a false deny blocks legitimate work. The hook's header records the one accepted consumer-side false positive (a consumer repo whose install leaves a real `node_modules/.bin/biome` on `PATH`), kept deliberately because the deny message names working alternatives. Coverage is keyed to the script name across all four package managers, not this repo's own, since an agent that cannot run `biome` reaches for whichever runner is available. See `../cli/architecture.md` and the root `CLAUDE.md` for the `npx biome` impostor that makes the bare route a false green here.

## biome-prefer-mcp: nudge, never block

`hooks/pre-tool-use/biome-prefer-mcp.sh` (`matcher: "Bash"`, registered just before the deny hook) detects Biome run through Bash — directly, or indirectly via a package-manager/turbo script whose nearest `package.json` mentions `biome` — and emits a **once-per-session** `additionalContext` nudge toward `biome_check`. It emits no `permissionDecision`, so it is purely additive; the deny hook's decision is authoritative on the same command, and the two stay separate scripts precisely so the behavioral gate never compromises the nudge's additive guarantee. The once-per-session marker keys on the envelope `session_id` under `~/.claude/session-env/`. Two boundary rules keep it from misfiring:

- **Subagent suppression.** The envelope carries `agent_id` only inside a dispatched subagent, and subagents run with a curated `tools:` allowlist, so a "prefer `biome_check`" nudge there is either redundant or a dead end (no such tool → fall back to Bash Biome → re-trigger, a loop with no exit). The hook emits nothing when `agent_id` is present, and checks that before touching the marker so a subagent never consumes the main thread's one nudge.
- **Command-position matching.** Biome counts as invoked only when it is the first token of a control-operator-delimited segment (after peeling `env`, inline assignments and runner prefixes), not when "biome" appears as a later argument or inside quoted prose. It is deliberately not a full shell parser — command substitutions are not descended into, a false-negative-over-false-positive choice consistent with "a nudge, not a parser".

## Shared segmentation

Both hooks source `hooks/lib/split-segments.sh` for quote-aware, control-operator-aware command segmentation and runner-prefix peeling (`env`, `VAR=value`, `sudo`, `command`, `time`, `exec`, `npx`/`bunx`, `bun x`, `pnpm|yarn dlx`, `pnpm|npm|yarn|bun [run]`, reduced to the invoked binary). Splitting into command-position segments first means each hook only has to recognize its target shape at the start of an isolated sub-command rather than run one giant regex over the raw string, and a fix to the segmenter happens once. The awk segmenter is O(n) so multi-KB heredoc commands stay fast; its header explains the `RS` choice.

## Rationale

Three channels exist because no single one covers every intent: the LSP is free feedback but cannot fix, the MCP tool fixes but must be asked, and the sanctioned scripts are the only Bash route that is config-safe by construction. The deny is a deny rather than a nudge because the hazard is corruption of vendored trees, not style — but it stays syntactic and narrow because a false deny costs more than a missed one.
