---
type: Module
title: cli
description: The savvy binary — the single command host for the Silk Suite's everyday dev tooling.
kind: package
resource: ../../packages/cli
status: draft
tags: [architecture, tooling]
sources:
  - id: arch
    resource: ../../packages/cli/src
  - id: repos-group
    resource: ../../packages/cli/src/commands/repos
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 9282557051926a7c4a4a449f7f31596e493367652d9fe02486aadbae81f3a489
---

# cli

## Boundary

`@savvy-web/cli` (`packages/cli`) owns the `savvy` binary and its statically-defined command tree — a thin command shell over [`silk-effects`](silk-effects.md), built on Effect v4's in-core `effect/unstable/cli` and `@effect/platform-node`. Almost all of its business logic lives in silk-effects: every command handler imports the work it does from there, and this package exists to wire those handlers into one `effect/unstable/cli` tree and provide the runtime layer stack that satisfies their service requirements. The lone exception is `savvy clean`, whose filesystem artifact removal has no silk-effects equivalent.[^arch]

It is an L3 front end in the package layering, a peer of [`mcp`](mcp.md) that never imports it — the `@e2e/workspace` DAG check asserts this as a layering rule. See [package-layering](../conventions/package-layering.md).[^arch]

The command tree and flag/exit-code contract are documented from the consumer side in [savvy-cli](../interfaces/savvy-cli.md); this concept covers the module's boundary, ownership, and runtime wiring.

## Owner

Bound by [package-layering](../conventions/package-layering.md); shaped by [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md) and [silk-pins-siblings-as-dependencies](../decisions/silk-pins-siblings-as-dependencies.md).

## Entry points

The package follows the `./main` contract shared with the MCP server: `src/bin.ts` is the shebang shim, `src/main.ts` owns the process (builds `Command.run(rootCommand, …)`, provides `AppLive`, calls `NodeRuntime.runMain`, and is exported at `@savvy-web/cli/main`), and `src/index.ts` is the side-effect-free library barrel. `@savvy-web/silk` owns a mirror `savvy` bin that imports `@savvy-web/cli/main` and calls the same `main()` — the one sanctioned import of cli from silk.[^arch]

## The runtime layer stack

The whole service graph is assembled once as `AppLive` in `src/cli/index.ts`. Four structural choices matter:

- **`provideMerge`, not `provide`**, for base services — so a service such as `Changesets.ConfigInspector` (shared by `BranchAnalyzer`, `ReleasePlanner`, and the `config validate` handler) is built once per run and re-exposed to handlers that yield the tag directly.[^arch]
- **Minimal workspace wiring.** `WorkspaceLive` hand-wires the `WorkspaceRoot`/`WorkspaceDiscovery`/`PackageManagerDetector` trio directly rather than pulling in a batteries-included workspace layer that would fork background work most commands do not need.[^arch]
- **Tool discovery and section management are kit layers**, not silk-effects layers — `ToolDiscovery` from `@effected/commands`, `ManagedSection` from `@effected/templates` — bound to `const`s so each memoizes into one instance per process.[^arch]
- **`DepsRegen` is deliberately NOT in `AppLive`.** Its graph is root-bound at layer *build* time, so binding it once at startup would freeze it to the CLI's launch cwd and ignore a command's `--cwd`; the `deps regen`/`deps detect` handlers instead compose `Changesets.makeDepsRegenDefault({ cwd })` per invocation.[^arch]

## The `savvy repos` command group

`savvy repos` is the CLI half of the vendored-reference-repo lifecycle: one thin handler per `Repos.ReposManager` method plus the `status --drift` reconciliation read. Business logic lives entirely in silk-effects' `Repos` namespace (see [silk-effects](silk-effects.md#repos)); these handlers decode flags, render, and set exit codes.[^repos-group]

Handlers render outcome, not attempt — `restore`'s `stillDirty` names every repo whose worktree is still dirty after the reset ran, and the handler warns and sets a non-zero exit code even though the operation itself completed. `reposCommand` carries a hand-written `Command.Command<...>` type annotation because `Command.withSubcommands` infers a type referencing effect's non-exported `Inspectable` module, which cannot survive declaration emit.[^repos-group]

## Boundaries and invariants

- **`@savvy-web/cli` never imports `@savvy-web/silk` or `@savvy-web/mcp`.** All logic comes from silk-effects; the `@e2e/workspace` DAG check asserts it.[^arch]
- **No `peerDependencies` block.** The Effect closure is sealed as regular `dependencies` — the same posture as mcp and tsdown-plugins.[^arch]
- **The engine takes its `cwd` from this package.** silk-effects' `ConfigDiscovery` and `BiomeSchemaSync` no longer default to `process.cwd()`; every call passes it explicitly, as the process owner.[^arch]
- **Every hook-section id the CLI declares is spelled UPPERCASE** — a lowercase key does not error but silently grows a duplicate block. See [managed-hook-sections](../interfaces/managed-hook-sections.md).[^arch]
- **`savvy commit hook pre-commit-message` gates its rule set on document kind** — commit-body rules apply only to a real commit message; `plan-leakage` and `closes-trailer` apply to both a commit message and a PR body. See [commit-and-pr-messages](../conventions/commit-and-pr-messages.md).[^arch]
- **`savvy lint fmt <name>` owns argument parsing only** — the byte-format step is a public static shared with the lint-staged handler, never duplicated in the subcommand.[^arch]
- `silk` depends on `cli` as an exact-pinned regular dependency; its `src/bin/savvy.ts` shim is the one sanctioned import of cli from silk. See [silk-pins-siblings-as-dependencies](../decisions/silk-pins-siblings-as-dependencies.md).[^arch]

## Related concepts

- [silk-effects](silk-effects.md) — the engine every command handler delegates to
- [mcp](mcp.md) — the sibling L3 front end
- [savvy-cli](../interfaces/savvy-cli.md) — the command tree and flag/exit-code contract
- [package-layering](../conventions/package-layering.md) — the layering rule this package's non-import invariant enforces

[^arch]: `../../packages/cli/src`
[^repos-group]: `../../packages/cli/src/commands/repos`
