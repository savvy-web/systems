---
status: current
module: mcp
category: architecture
created: 2026-05-31
updated: 2026-09-12
last-synced: 2026-09-12
completeness: 92
related:
  - ./decision-effect-native.md
  - ./tools.md
  - ./changeset-tools.md
  - ./biome-check.md
  - ./repos-tools.md
  - ../silk-effects/architecture.md
  - ../cli/architecture.md
  - ../silk/plugin.md
  - ../workspace/package-layering.md
  - ../testing/effect-vitest.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/mcp architecture

The `savvy-mcp` server — a standalone, spawnable, tools-only MCP server that serves Silk Suite tooling to coding agents as structured tools. One Effect `Layer`: a ten-tool `Toolkit` from `effect/unstable/ai` registered against `McpServer.layerStdio`, with the `@savvy-web/silk-effects` service graph discharging every handler's dependencies. No MCP SDK, no zod.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [Entry points](#entry-points)
- [The server layer](#the-server-layer)
- [The runtime layer](#the-runtime-layer)
- [Root resolution](#root-resolution)
- [Plugin integration](#plugin-integration)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`@savvy-web/mcp` owns the `savvy-mcp` binary: a long-lived MCP server, spawned (never typed by a human) alongside an agent in the project working directory and shared across Claude Code plugins. It exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output instead of parsed console text.

It is a **tools-only** server: MCP tools and zero resources. Tool logic comes from `@savvy-web/silk-effects`, the same business layer the `savvy` CLI uses; the tool files are glue. It is not a discovery host and carries no per-project gating — direction lives in the plugins, each of which orients the agent toward the tools it should prefer.

**Package:** `@savvy-web/mcp`, at `packages/mcp` — an L3 front end in the [package layering](../workspace/package-layering.md), a peer of `@savvy-web/cli` that never imports it. The `savvy-mcp` bin (`src/bin.ts`) calls `main()` from `src/main.ts` (exported as `@savvy-web/mcp/main`), which launches `ServerLayer(cwd)` from `src/server.ts` over stdio. ESM-only, built via `@savvy-web/bundler`; `src/version.ts` reads the version the builder stamps at build time (`0.0.0` means an unbuilt source run).

## Current state

The server is Effect-native as of savvy-web/systems#632 — the decision, the rejected alternatives, the framework mirror and the six rc.115 gotchas are in [decision-effect-native.md](./decision-effect-native.md). It ships one `Tool.make` value per tool under `src/tools/`, the `SilkToolkit` that gathers the ten in `src/toolkit.ts`, the registration and stdio layer in `src/server.ts`, and MCP wiring for the repo's one Claude Code plugin, `plugins/silk`, which spawns it. The tool surface is documented in four child docs by subsystem:

- [tools.md](./tools.md) — the conventions every tool follows (Effect Schema as canon, `Tool.make` with declared dependencies, the dual-channel result via the `SilkMarkdown` annotation, read-only vs mutating annotations) plus the read-only inspection tools `workspace_info` and `turbo_inspect`.
- [changeset-tools.md](./changeset-tools.md) — `changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_detect` and the mutating `changeset_deps_regen`.
- [biome-check.md](./biome-check.md) — `biome_check`, the one tool that shells a CLI directly, with its severity and containment invariants.
- [repos-tools.md](./repos-tools.md) — `repos_inspect` and the mutating `repos_manage`, which together own the vendored-repo lifecycle and the `.repos/**` permissions boundary.

`@savvy-web/mcp` depends on `@savvy-web/silk-effects` (`workspace:*`) for tool logic, the `@effected/*` kit (`workspaces`, `commands`, `git`), `effect` and `@effect/platform-node`. See `package.json` for exact ranges; there is deliberately no `peerDependencies` block — the Effect closure is sealed as regular dependencies. The three kit entries and `effect` are load-bearing even where no `src/` file imports them directly: they satisfy silk-effects' required peers, and removing one breaks installs, not lint (see [package-layering.md](../workspace/package-layering.md#dependencies-versus-peers)). Unlike `@savvy-web/silk`, which bundles silk-effects for CJS `require()` reasons, the MCP is a real Node process, so silk-effects is a normal runtime dependency, not bundled.

## Entry points

The package follows the `./main` contract shared with the CLI ([package-layering.md](../workspace/package-layering.md#the-main-entry-contract)): `src/bin.ts` is the shebang shim (`import { main } from "./main.js"; await main();`), `src/main.ts` owns the process, and `src/index.ts` is the side-effect-free barrel exporting `SilkToolkit`, `ToolsLayer`, `ServerLayer`, `makeSilkRuntimeLayer`, the error classes, `SilkMarkdown` and `CURRENT_MCP_VERSION` — never `main`. `@savvy-web/silk`'s `savvy-mcp` bin is a mirror shim over `@savvy-web/mcp/main`, so both bins run the same `main()`.

`main()` does three things in order, and the order is the point. It registers `uncaughtException`/`unhandledRejection` handlers that write `savvy-mcp: <label>: <stack>` to stderr and exit 1. Only then does it dynamically import everything reachable from the tool surface (`@effect/platform-node`, `effect`, `./server.js`, `./internal/project-root.js`), so an import-time failure in the graph is reported by a handler instead of crashing before one exists. Finally it launches `Layer.launch(ServerLayer(cwd))` provided with `NodeServices.layer`, `Logger.layer([Logger.consolePretty()])` and `Layer.succeed(Logger.LogToStderr, true)`, under `NodeRuntime.runMain` with a custom `teardown` that maps success-or-interrupts-only to exit 0. Those last two provisions are gotchas 4 and 5 of the decision record; nothing is written to stderr on a clean run, and the e2e asserts exactly that.

## The server layer

`ServerLayer(cwd): Layer.Layer<never, never, PlatformServices>` composes, innermost out: `registerSilkToolkit(SilkToolkit)` as `Layer.effectDiscard` over `McpServer.McpServer.layer` and `ToolsLayer(cwd)`; `makeSilkRuntimeLayer(cwd)` discharging the handlers' declared services; and `McpServer.layerStdio({ name: "savvy-mcp", version, protocols: [v2025_11_25, v2025_06_18] })`, `Layer.orDie`d because the two-element protocol literal is an implementer-time fact. `PlatformServices` is `FileSystem | Path | ChildProcessSpawner | Stdio` — `NodeServices.layer` supplies all four in `main.ts`; the in-process tests swap `Stdio` for `Stdio.layerTest`.

Registration goes through the public `McpServer.addTool` rather than `McpServer.toolkit` so each success carries the tool's markdown transcript in `content[0].text` and the untouched typed result in `structuredContent`. That mirror, its drift baseline and the `outputSchema` hoisting are documented in [decision-effect-native.md](./decision-effect-native.md#the-addtool-mirror-and-its-drift-baseline); `src/server.ts`'s header is the in-code authority.

## The runtime layer

One long-lived service graph, built from `makeSilkRuntimeLayer(cwd)` in `src/runtime.ts` and composed **directly** from `silk-effects` and `@effected/*` kit exports — both of which mcp may import, so the layering holds without indirection. `McpServices` (also in `src/runtime.ts`; the old `src/context.ts` is gone) is the exact service union the layer provides, and it is what `ServerLayer` provides to the handlers' declared `dependencies`. There is no `ManagedRuntime` and no per-handler context object any more: `ToolsLayer(cwd)` closes each handler over the startup `cwd` as its fallback, and the framework runs handlers against the registration-time services.

The composition rests on **one reference, one construction**. The kit graph is `Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd })` — `Workspaces.layerWithGit`'s service set with config-dependency `pnpmfile` hook replay in catalog assembly (subprocess variant, bundle-safe), so hook-injected catalogs such as `catalog:effected` resolve to their declared ranges in dependency diffs instead of concrete lockfile versions. It mints a fresh layer per call, so it is bound to a `const` and provided ONCE via `Layer.provideMerge`; layer memoization by reference then builds each kit service exactly once, root-bound to the resolved project dir. The same discipline gives the whole runtime a single shared `Changesets.ConfigInspector` feeding the branch analyzer, the release planner and `DepsRegen` — the CLI's pattern too — and a single `ToolDiscovery` (from `@effected/commands`, wired to this workspace by `Workspaces.localExecLayer({ cwd })`), so one binary-probe cache serves the server's whole lifetime. Because these instances live as long as the process, caches are refreshed per call rather than per layer build (see [changeset-tools.md](./changeset-tools.md#the-shared-inspector)).

Two wiring subtleties are worth knowing before touching the file. `DepsRegen` is gated by silk's `SilkPublishability.layerAdaptive`, provided *closer* than the kit graph so it wins over the kit's npm-semantics default — the "versionable minus ignored" rule the savvy CLI also uses. And `FileSystem`/`Path` are re-exposed on the layer's own output via a `Layer.effectContext` passthrough rather than fully discharged by `NodeServices.layer` at the host boundary, because `repos_inspect`'s `gitmodules` mode reads `.gitmodules` through the ambient services; both are already required inputs, so the passthrough adds no new requirement. The remaining platform requirements (`ChildProcessSpawner`, `FileSystem`, `Path`) flow up to `main.ts`, which supplies `NodeServices.layer` at the edge. `src/runtime.ts` is short and is the authority for the exact wiring; the `Repos` services' lockdown wiring is covered in [repos-tools.md](./repos-tools.md#the-permissions-boundary).

The smoke tests `__test__/runtime.smoke.test.ts` and `__test__/server.smoke.test.ts` are the layer-completeness gate, exactly as in the CLI: a missing service names itself at runtime, not at typecheck. They are also the repo's canonical use of a **suite-boundary `layer(...)` block** (`@effect/vitest`), which is otherwise avoided in favor of per-test `Effect.provide` — see [effect-vitest.md](../testing/effect-vitest.md#layer-provision-per-test-effectprovide-is-the-default). Sharing is correct here specifically because the runtime is root-bound at layer build, so one built layer per fixture root is the thing under test, and every test in the group is read-only against that root. Two ordering constraints follow and are documented in-file: the fixture is created in `beforeAll` rather than at module scope (a load-time throw zeroes the whole package — `0/0 passed`, exit 0 — instead of reporting a named hook failure), and `makeSilkRuntimeLayer(dir)` is wrapped in `Layer.suspend` so construction is deferred to layer-build time, which `layer(...)` performs in its own nested `beforeAll`.

## Root resolution

`main()` resolves its base directory through the pure, unit-tested `resolveProjectDir(argv, env, cwd)` in `src/internal/project-root.ts`, by precedence `argv[2]` → `SAVVY_MCP_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()` (an unexpanded `${...}` placeholder or whitespace-only `argv[2]` is ignored). `main.ts` is the only place `process.argv`/`process.env` are read. Because dev tooling launches the server from `packages/mcp/` rather than the repo root, every Effect-backed tool handler additionally resolves the true workspace root by walking up from the base dir (or an explicit `cwd` argument) via `WorkspaceRoot.find` before doing anything, so the tools work from any subdirectory. The walk-up lives in the **mcp handlers, not the analyzer**, so the analyzer/CLI contract is unchanged. `biome_check` is the one exception — it mutates, so it resolves a containment root instead (see [biome-check.md](./biome-check.md#containment)).

## Plugin integration

A plugin declares the server via an `mcpServers` block in its `.claude-plugin/plugin.json` whose command runs a `bin/start-mcp.sh` launcher that execs the project's own `node_modules/.bin/savvy-mcp` (installed by the `@savvy-web/silk` carrier) and otherwise prints an install hint and falls back to `npx --yes @savvy-web/mcp` — never a package-manager dispatch — exporting the project dir as both `CLAUDE_PROJECT_DIR` and `SAVVY_MCP_PROJECT_DIR`. `plugins/silk` is the only plugin in this repo that does so, registered in the repo's `.claude-plugin/marketplace.json`; the launcher/declaration pattern is the contract for any plugin that spawns the server, in this repo or another.

**Information lives in the server, direction lives in the plugin.** A spawning plugin adds its own SessionStart orientation hooks pointing the agent at the tools it should prefer. The shared server carries every tool regardless of the current project; the plugin decides which to surface. See [plugin.md](../silk/plugin.md) for the silk orientation.

Spawning is per-declaring-plugin, so a session with more than one plugin declaring this server may get one instance each. The server is stateless and lightweight, so that is acceptable rather than something to deduplicate.

## Boundaries and invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from `silk-effects` and the `@effected/*` kit; the DAG check in `@e2e/workspace` asserts it as a layering rule.
- **`src/index.ts` never exports `main`.** The process owner lives at `./main` so importing the barrel registers no crash guards and imports no server graph.
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency, not bundled — the opposite of `@savvy-web/silk`'s dual-format CJS-bundling requirement.
- **Effect Schema is the only schema language.** Parameters, results and the `McpToolError` failure union are Effect `Schema`; the framework derives the wire JSON Schema. There is no zod and no bridge.
- **stdout is the JSON-RPC wire; logs go to stderr; a clean disconnect exits 0.** `Logger.LogToStderr` and the custom `teardown` in `main.ts` are load-bearing and each is pinned by an e2e.
- **Read-only is the convention; `biome_check`, `changeset_deps_regen` and `repos_manage` are the three documented exceptions.** How each is annotated and what each may touch is in [tools.md](./tools.md#read-only-versus-mutating).
- **The runtime is root-bound at layer build.** One server instance serves one project dir; per-call `cwd` arguments walk up to a workspace root but do not rebuild the layer.

## Rationale

### Why a standalone server, not a discovery host

A thin discovery host reading a contribution contract from installed packages was considered and dropped as premature coupling. A standalone server with a fixed tool surface ships value now, and keeping direction in the plugins already gives per-project tailoring without a discovery seam. The CLI remains the bridge for what tools do not cover.

### Why Effect-native

Answered in [decision-effect-native.md](./decision-effect-native.md).

### Why the runtime composes its own stack instead of the CLI's

`makeSilkRuntimeLayer` composes its own layer rather than hoisting the CLI's `AppLive`. The two runtimes genuinely diverge (the CLI does not include the workspace analyzer), and the only overlapping surfaces — the workspace services and the `ToolDiscovery`/`localExec` pair — are wired differently on each side (the CLI hand-composes a minimal `WorkspaceRoot`/`WorkspaceDiscovery`/`PackageManagerDetector` trio; the MCP takes the batteries-included kit graph it already needs for the analyzer). A shared layer would couple two diverging consumers for negligible gain; extracting one is deferred until a second host needs the same composition. No CLI code is touched by this package.

## Related documentation

- [decision-effect-native.md](./decision-effect-native.md) — the Effect-native decision, the framework mirror and the rc.115 gotchas.
- [package-layering.md](../workspace/package-layering.md) — the `./main` contract and the carrier that owns the `savvy-mcp` bin.
- [tools.md](./tools.md) — tool conventions and the read-only inspection tools.
- [changeset-tools.md](./changeset-tools.md) — the changeset tool family.
- [biome-check.md](./biome-check.md) — the Biome proxy tool.
- [repos-tools.md](./repos-tools.md) — the vendored-repo tools.
- [silk-effects/architecture.md](../silk-effects/architecture.md) — the services every tool wraps.
- [cli/architecture.md](../cli/architecture.md) — the sibling host with its own runtime stack.
- [silk/plugin.md](../silk/plugin.md) — the plugin that spawns and orients this server.
