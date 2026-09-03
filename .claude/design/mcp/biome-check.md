---
status: current
module: mcp
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./architecture.md
  - ./tools.md
  - ./changeset-tools.md
  - ./repos-tools.md
  - ../silk/plugin.md
dependencies:
  - ./architecture.md
  - ./tools.md
---

# @savvy-web/mcp biome_check

The `biome_check` tool — a thin proxy that shells the Biome CLI and returns typed diagnostics — and the two invariants that keep it honest: the severity mapping and containment.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [Execution flow](#execution-flow)
- [Severity mapping](#severity-mapping)
- [Containment](#containment)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`biome_check` (`src/tools/biome-check.ts`) departs from every other tool in two ways. No silk-effects service backs it — silk-effects is reused only for `Lint.Biome.findBiome()` binary resolution — and it does not run on the Effect runtime; the handler is a plain async `spawnSync` over Biome. It is one of the three mutating tools (see [tools.md](./tools.md#read-only-versus-mutating)): `write`/`unsafe` apply fixes, both default off, so a bare call only reads. The plugin side — the Biome LSP, the nudge hook that steers agents here instead of to bare `biome`, and the deny hook on every direct Biome route — is in [plugin.md](../silk/plugin.md).

## Current state

The result schema is flat: a summary, the diagnostics, a `wrote` flag and a fixed `guidance` string that steers the agent to fix code rather than silence rules (the guidance text varies with whether real errors, only project warnings or strict-upgraded warnings remain). It registers no annotations. The file holds the schema, the gitlab parser, the containment logic and the handler; see it for parameters.

## Execution flow

The flow is **fix-then-validate over the stable `gitlab` reporter** (not the experimental `json` reporter). When `write`/`unsafe` is set the handler runs a fix pass first, then always runs a read pass that reports what *remains*. stdout is parsed regardless of exit code — Biome's `0` and `1` both carry diagnostics; only `>1` means Biome itself failed and surfaces as a tool error. Both passes run with a hard timeout and `SIGKILL` so a hung Biome cannot block the server. Returning structured data instead of Bash stdout sidesteps the Bash tool's output truncation.

## Severity mapping

The gitlab severity scale maps onto the result's three-level `error`/`warning`/`info`, and that mapping is the **exact inverse of Biome's own encoding** and must stay that way. Biome's gitlab reporter (`crates/biome_cli/src/reporter/gitlab.rs`) writes `Hint => info`, `Information => minor`, `Warning => major`, `Error => critical`, `Fatal => blocker`. Reading `minor` as a warning and `major` as an error shifts every diagnostic one level too severe, so a project warning arrives as `severity: "error"` with `warnings: 0` and no `originalSeverity`, indistinguishable at the call site from a real error — a green repo reads as red, and because the plugin positions this tool as preferable to shelling out, its severities get trusted rather than cross-checked. `strict` is the ONLY thing that may promote a warning: it upgrades in-process (never via `--error-on-warnings`) so each promoted diagnostic keeps its `originalSeverity` and the summary can count `upgradedWarnings` separately.

## Containment

Because `write`/`unsafe` mutate the tree, this tool does not use `WorkspaceRoot.find` like the others. `resolveContainmentRoot` fixes one directory tree per run and every target path is canonicalized (`realpathSync`, so a symlink cannot pass a lexical prefix check) and checked against it. A `cwd` inside the server's root keeps that root. A `cwd` outside it is accepted **only** when it belongs to a *different* worktree of the same repository — a shared git common dir but a different top level — and containment then follows that worktree, because a root-bound run invoked from a sibling worktree would otherwise silently rewrite the main checkout, which during parallel agent work is another agent's tree. Sharing a common dir is not sufficient on its own: when both probes report the same top level, `root` is a strict subdirectory of its own worktree (dev tooling launches the server from `packages/mcp/`), and widening to that top level would hand a `--write` pass the whole checkout, `.repos/**` included. That case is rejected. The git probe is injectable, which is how `__test__/tools/biome-check.test.ts` covers the decision table without real worktrees.

## Rationale

### Why a proxy rather than a silk-effects service

Biome is already a first-class CLI with a stable machine-readable reporter, and the value the tool adds is structure, containment and severity fidelity — not orchestration. Wrapping it in an Effect service would add a layer without adding a capability, so the tool is deliberately the smallest of the three mutating surfaces.

### Why honor project severities by default

The tool is presented to agents as the preferred route to Biome, so it has to agree with what `biome check` prints in the project's own config; otherwise agents chase warnings the project tolerates or churn unrelated files. `strict` exists for callers who want a harder gate, and it marks what it promoted so the two are never confused.

## Related documentation

- [architecture.md](./architecture.md) — the server this tool is registered on.
- [tools.md](./tools.md) — the conventions it partially departs from.
- [silk/plugin.md](../silk/plugin.md) — the LSP, nudge and deny hooks around it.
