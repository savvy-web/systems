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
  - id: main
    resource: ../../packages/cli/src/main.ts
  - id: output
    resource: ../../packages/cli/src/internal/output.ts
  - id: test-utils
    resource: ../../packages/cli/__test__/utils
  - id: boundaries
    resource: ../../packages/cli/__test__/boundaries.test.ts
  - id: layering
    resource: ../../packages/silk/__test__/package-layering.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-25T02:44:37Z
  body_sha256: 5520319c26a387b816cc0e316a048b27d55aad3322dd25cb8fe6719cf1457de0
---

# cli

## Boundary

`@savvy-web/cli` (`packages/cli`) owns the `savvy` binary and its statically-defined command tree — a thin command shell over [`silk-effects`](silk-effects.md), built on Effect v4's in-core `effect/unstable/cli` and `@effect/platform-node`. Almost all of its business logic lives in silk-effects: every command handler imports the work it does from there, and this package exists to wire those handlers into one `effect/unstable/cli` tree and provide the runtime layer stack that satisfies their service requirements. The lone exception is `savvy clean`, whose filesystem artifact removal has no silk-effects equivalent.[^arch]

It is an L3 front end in the package layering, a peer of [`mcp`](mcp.md) that never imports it — silk's package-layering test asserts this as a layering rule. See [package-layering](../conventions/package-layering.md).[^layering]

The command tree and flag/exit-code contract are documented from the consumer side in [savvy-cli](../interfaces/savvy-cli.md); this concept covers the module's boundary, ownership, and runtime wiring.

## Owner

Bound by [package-layering](../conventions/package-layering.md); shaped by [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md), [silk-pins-siblings-as-dependencies](../decisions/silk-pins-siblings-as-dependencies.md) and [front-ends-adopt-effected-kit](../decisions/front-ends-adopt-effected-kit.md).

## Entry points

The package follows the `./main` contract shared with the MCP server: `src/bin.ts` is the shebang shim, `src/main.ts` owns the process and is exported at `@savvy-web/cli/main`, and `src/index.ts` is the side-effect-free library barrel. `main(options?: MainOptions)` builds `Command.run(rootCommand, { version: CLI_VERSION })`, provides `AppLive`, a `CliColor.formatterLayer` whose `formatVersion` is `VersionLine.format`, and `CurrentDistribution` once, then runs `NodeRuntime.runMain(CliRuntime.main(program, { platform: CliPlatform, render: FailureLine.render }))`. `CliRuntime.main` (`@effected/cli`) provides the platform and the kit-default `CliLogger`, reports a failure through that logger, applies the `CliExit` code a command set, and exits `64` on a usage error.[^main] `MainOptions.distribution` names the carrier the bin was installed through: `@savvy-web/silk` owns a mirror `savvy` bin that imports `@savvy-web/cli/main` and calls `main({ distribution: { name: "@savvy-web/silk", version } })` — the one sanctioned import of cli from silk — so `--version` prints `savvy v<cli> via @savvy-web/silk <silk>`; a direct install prints the bare `savvy v<cli>`. `CLI_VERSION` lives alone in `src/version.ts` so its build-time `process.env` read stays at the edge.[^main]

## The runtime layer stack

The whole service graph is assembled once as `AppLive` in `src/cli/index.ts`, still open on the platform services: `NodeServices.layer` is exported separately as `CliPlatform` and handed to `CliRuntime.main`, so the platform is provided once, at the edge. Four structural choices matter:

- **`provideMerge`, not `provide`**, for base services — so a service such as `Changesets.ConfigInspector` (shared by `BranchAnalyzer`, `ReleasePlanner`, and the `config validate` handler) is built once per run and re-exposed to handlers that yield the tag directly.[^arch]
- **Minimal workspace wiring.** `WorkspaceLive` hand-wires the `WorkspaceRoot`/`WorkspaceDiscovery`/`PackageManagerDetector` trio directly rather than pulling in a batteries-included workspace layer that would fork background work most commands do not need.[^arch]
- **Tool discovery and section management are kit layers**, not silk-effects layers — `ToolDiscovery` from `@effected/commands`, `ManagedSection` from `@effected/templates` — bound to `const`s so each memoizes into one instance per process.[^arch]
- **`DepsRegen` is deliberately NOT in `AppLive`.** Its graph is root-bound at layer *build* time, so binding it once at startup would freeze it to the CLI's launch cwd and ignore a command's `--cwd`; the `deps regen`/`deps detect` handlers instead compose `Changesets.makeDepsRegenDefault({ cwd })` per invocation.[^arch]

## The `savvy repos` command group

`savvy repos` is the CLI half of the vendored-reference-repo lifecycle: one thin handler per `Repos.ReposManager` method plus the `status --drift` reconciliation read. Business logic lives entirely in silk-effects' `Repos` namespace (see [silk-effects](silk-effects.md#repos)); these handlers decode flags, render through `Output`, and set exit codes through `CliExit`.[^repos-group]

Handlers render outcome, not attempt — `restore`'s `stillDirty` names every repo whose worktree is still dirty after the reset ran, and the handler warns and sets a non-zero exit code even though the operation itself completed. `reposCommand` carries a hand-written `Command.Command<...>` type annotation because `Command.withSubcommands` infers a type referencing effect's non-exported `Inspectable` module, which cannot survive declaration emit.[^repos-group]

## Output, logs, and exit codes

stdout carries only a command's product: the human result lines written through `Output` (`src/internal/output.ts` — `ok ✓`, `warn ⚠`, `fail ✗`, `skip •`, `heading`, `detail`, `line`, `summary`), JSON documents written with `Console.log`, and hook envelopes written with `process.stdout.write`. Every `Effect.log*` line, including a failure's explanation, goes to stderr through the kit-default `CliLogger`, with no timestamp or level prefix. `Output` tints only the glyph or heading, and only when `CliColor.enabled` holds (stdout a TTY and `NO_COLOR` unset), so piped text reads the same.[^output]

A command reports findings with `CliExit.set(1)` and never writes `process.exitCode` or calls `process.exit`; `CliRuntime.main` owns the exit. `__test__/boundaries.test.ts` pins that with `@effected/workspaces/testing`'s `SourceBoundary`, and ratchets the files under `src/` that read `process` at all to today's list — a new reader fails the test until it is added deliberately.[^boundaries]

## Testing the command handlers

A handler test runs the handler as `main()` would and asserts on data, never on patched globals. `__test__/utils/capture.ts`'s `Capture.run(effect)` provides the kit-default `CliLogger`, a fresh `CliExit` and a recording `Console`, and returns `{ value, stdout, stderr, exitCode }`; `Capture.layer(stdout, stderr)` is the same recording for a test that builds its own layer stack, and `Capture.piped` is a `Stdio` whose stdout is not a terminal, so `Output` emits no colour. `__test__/utils/exit.ts`'s `TestExit` is a per-file `CliExit` cell (`TestExit.layer`, `reset()` in `beforeEach`, `code()`). A test that only needs the handler's return value silences logging with `Layer.merge(Logger.layer([]), Capture.piped)`. The capture mechanism decides the runner: `Capture` swaps the `Console` reference and so works under `it.effect`, but a test that spies on the real `console.log` must run under `it.live`, because `it.effect` installs `TestConsole`, which swallows `Console.log` writes before the spy sees them. The built bin is covered by `__test__/e2e/bin.e2e.test.ts`, spawned hermetically through `@effected/cli/testing`'s `CliTest`: the bare `--version` line, and a usage error exiting `64` with the error on stderr.[^test-utils]

## Boundaries and invariants

- **`@savvy-web/cli` never imports `@savvy-web/silk` or `@savvy-web/mcp`.** All logic comes from silk-effects; silk's package-layering test asserts the edge never exists.[^layering]
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
[^main]: `../../packages/cli/src/main.ts`
[^output]: `../../packages/cli/src/internal/output.ts`
[^test-utils]: `../../packages/cli/__test__/utils`
[^boundaries]: `../../packages/cli/__test__/boundaries.test.ts`
[^layering]: `../../packages/silk/__test__/package-layering.test.ts`
