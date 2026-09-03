---
status: current
module: mcp
category: architecture
created: 2026-05-31
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./tools.md
  - ./changeset-tools.md
  - ./biome-check.md
  - ./repos-tools.md
  - ../silk-effects/architecture.md
  - ../cli/architecture.md
  - ../silk/plugin.md
  - ../testing/effect-vitest.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/mcp architecture

The `savvy-mcp` server — a standalone, spawnable, tools-only MCP server that serves Silk Suite tooling to coding agents as structured tools. Built on an Effect `ManagedRuntime` over `@savvy-web/silk-effects` plus the `@modelcontextprotocol/sdk`.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The runtime layer](#the-runtime-layer)
- [Root resolution](#root-resolution)
- [Plugin integration](#plugin-integration)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`@savvy-web/mcp` owns the `savvy-mcp` binary: a long-lived MCP server, spawned (never typed by a human) alongside an agent in the project working directory and shared across Claude Code plugins. It exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output instead of parsed console text.

It is a **tools-only** server: MCP tools and zero resources. Tool logic comes from `@savvy-web/silk-effects`, the same business layer the `savvy` CLI uses; the tool files are glue. It is not a discovery host and carries no per-project gating — direction lives in the plugins, each of which orients the agent toward the tools it should prefer.

**Package:** `@savvy-web/mcp`, at `packages/mcp`. The `savvy-mcp` bin (`src/bin.ts`) builds the runtime and calls `startMcpServer()` in `src/server.ts`, which registers every tool and connects the stdio transport. ESM-only, built via `@savvy-web/bundler`; `src/version.ts` holds the version the builder stamps at build time (`0.0.0` means an unbuilt source run).

## Current state

The server ships one registration per tool in `src/server.ts`, one implementation file per tool under `src/tools/` and MCP wiring for the repo's one Claude Code plugin, `plugins/silk`, which spawns it. The tool surface is documented in three child docs by subsystem:

- [tools.md](./tools.md) — the conventions every tool follows (Effect Schema as canon, the dual-channel result, the Effect→zod bridge, read-only vs mutating annotations) plus the read-only inspection tools `workspace_info` and `turbo_inspect`.
- [changeset-tools.md](./changeset-tools.md) — `changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_detect` and the mutating `changeset_deps_regen`.
- [biome-check.md](./biome-check.md) — `biome_check`, the one tool that shells a CLI directly, with its severity and containment invariants.
- [repos-tools.md](./repos-tools.md) — `repos_inspect` and the mutating `repos_manage`, which together own the vendored-repo lifecycle and the `.repos/**` permissions boundary.

`@savvy-web/mcp` depends on `@savvy-web/silk-effects` (`workspace:*`) for tool logic, the `@effected/*` kit (`workspaces`, `commands`, `git`), the Effect runtime, `@modelcontextprotocol/sdk` and `zod` (v4, boundary-only). See `package.json` for exact ranges; there is deliberately no `peerDependencies` block — the Effect closure is sealed as regular dependencies. Unlike `@savvy-web/silk`, which bundles silk-effects for CJS `require()` reasons, the MCP is a real Node process, so silk-effects is a normal runtime dependency, not bundled.

## The runtime layer

One long-lived Effect `ManagedRuntime`, built from `makeSilkRuntimeLayer(cwd)` in `src/runtime.ts` and composed **directly** from `silk-effects` and `@effected/*` kit exports — both of which mcp may import, so the cli↔silk↔mcp non-import invariant holds without indirection. `McpServices` in `src/context.ts` is the exact service union the layer provides; `McpContext` pairs the runtime with the resolved project dir and is what every tool handler receives.

The composition rests on **one reference, one construction**. The kit graph is `Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd })` — `Workspaces.layerWithGit`'s service set with config-dependency `pnpmfile` hook replay in catalog assembly (subprocess variant, bundle-safe), so hook-injected catalogs such as `catalog:effected` resolve to their declared ranges in dependency diffs instead of concrete lockfile versions. It mints a fresh layer per call, so it is bound to a `const` and provided ONCE via `Layer.provideMerge`; layer memoization by reference then builds each kit service exactly once, root-bound to the resolved project dir. The same discipline gives the whole runtime a single shared `Changesets.ConfigInspector` feeding the branch analyzer, the release planner and `DepsRegen` — the CLI's pattern too — and a single `ToolDiscovery` (from `@effected/commands`, wired to this workspace by `Workspaces.localExecLayer({ cwd })`), so one binary-probe cache serves the server's whole lifetime. Because these instances live as long as the process, caches are refreshed per call rather than per layer build (see [changeset-tools.md](./changeset-tools.md#the-shared-inspector)).

Two wiring subtleties are worth knowing before touching the file. `DepsRegen` is gated by silk's `SilkPublishability.layerAdaptive`, provided *closer* than the kit graph so it wins over the kit's npm-semantics default — the "versionable minus ignored" rule the savvy CLI also uses. And `FileSystem`/`Path` are re-exposed on the layer's own output via a `Layer.effectContext` passthrough rather than fully discharged by `NodeServices.layer` at the host boundary, because `repos_inspect`'s `gitmodules` mode reads `.gitmodules` through the ambient services; both are already required inputs, so the passthrough adds no new requirement. The remaining platform requirements (`ChildProcessSpawner`, `FileSystem`, `Path`) flow up to `bin.ts`, which supplies `NodeServices.layer` at the edge. `src/runtime.ts` is short and is the authority for the exact wiring; the `Repos` services' lockdown wiring is covered in [repos-tools.md](./repos-tools.md#the-permissions-boundary).

The smoke tests `__test__/runtime.smoke.test.ts` and `__test__/server.smoke.test.ts` are the layer-completeness gate, exactly as in the CLI: a missing service names itself at runtime, not at typecheck. They are also the repo's canonical use of a **suite-boundary `layer(...)` block** (`@effect/vitest`), which is otherwise avoided in favor of per-test `Effect.provide` — see [effect-vitest.md](../testing/effect-vitest.md#layer-provision-per-test-effectprovide-is-the-default). Sharing is correct here specifically because the runtime is root-bound at layer build, so one built layer per fixture root is the thing under test, and every test in the group is read-only against that root. Two ordering constraints follow and are documented in-file: the fixture is created in `beforeAll` rather than at module scope (a load-time throw zeroes the whole package — `0/0 passed`, exit 0 — instead of reporting a named hook failure), and `makeSilkRuntimeLayer(dir)` is wrapped in `Layer.suspend` so construction is deferred to layer-build time, which `layer(...)` performs in its own nested `beforeAll`.

## Root resolution

The bin resolves its base directory by precedence `argv[2]` → `SAVVY_MCP_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()` (`src/bin.ts`; an unexpanded `${...}` placeholder in `argv[2]` is ignored). Because dev tooling launches the server from `packages/mcp/` rather than the repo root, every Effect-backed tool handler additionally resolves the true workspace root by walking up from the base dir (or an explicit `cwd` argument) via `WorkspaceRoot.find` before doing anything, so the tools work from any subdirectory. The walk-up lives in the **mcp handlers, not the analyzer**, so the analyzer/CLI contract is unchanged. `biome_check` is the one exception — it mutates, so it resolves a containment root instead (see [biome-check.md](./biome-check.md#containment)).

## Plugin integration

A plugin declares the server via an `mcpServers` block in its `.claude-plugin/plugin.json` whose command runs a `bin/start-mcp.sh` launcher (detect the package manager → `exec <pm> savvy-mcp`), passing the project dir through `CLAUDE_PROJECT_DIR`. `plugins/silk` is the only plugin in this repo that does so, registered in the repo's `.claude-plugin/marketplace.json`; the launcher/declaration pattern is the contract for any plugin that spawns the server, in this repo or another.

**Information lives in the server, direction lives in the plugin.** A spawning plugin adds its own SessionStart orientation hooks pointing the agent at the tools it should prefer. The shared server carries every tool regardless of the current project; the plugin decides which to surface. See [plugin.md](../silk/plugin.md) for the silk orientation.

Spawning is per-declaring-plugin, so a session with more than one plugin declaring this server may get one instance each. The server is stateless and lightweight, so that is acceptable rather than something to deduplicate.

## Boundaries and invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from `silk-effects` and the `@effected/*` kit, preserving the cli↔silk↔mcp non-import invariant.
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency, not bundled — the opposite of `@savvy-web/silk`'s dual-format CJS-bundling requirement.
- **Effect Schema is canonical; zod is a boundary-only dependency** confined to the `src/schema/effect-to-zod.ts` bridge at the SDK registration edge.
- **Read-only is the convention; `biome_check`, `changeset_deps_regen` and `repos_manage` are the three documented exceptions.** How each is annotated and what each may touch is in [tools.md](./tools.md#read-only-versus-mutating).
- **The runtime is root-bound at layer build.** One server instance serves one project dir; per-call `cwd` arguments walk up to a workspace root but do not rebuild the layer.

## Rationale

### Why a standalone server, not a discovery host

A thin discovery host reading a contribution contract from installed packages was considered and dropped as premature coupling. A standalone server with a fixed tool surface ships value now, and keeping direction in the plugins already gives per-project tailoring without a discovery seam. The CLI remains the bridge for what tools do not cover.

### Why the runtime composes its own stack instead of the CLI's

`makeSilkRuntimeLayer` composes its own layer rather than hoisting the CLI's `AppLive`. The two runtimes genuinely diverge (the CLI does not include the workspace analyzer), and the only overlapping surfaces — the workspace services and the `ToolDiscovery`/`localExec` pair — are wired differently on each side (the CLI hand-composes a minimal `WorkspaceRoot`/`WorkspaceDiscovery`/`PackageManagerDetector` trio; the MCP takes the batteries-included kit graph it already needs for the analyzer). A shared layer would couple two diverging consumers for negligible gain; extracting one is deferred until a second host needs the same composition. No CLI code is touched by this package.

## Related documentation

- [tools.md](./tools.md) — tool conventions and the read-only inspection tools.
- [changeset-tools.md](./changeset-tools.md) — the changeset tool family.
- [biome-check.md](./biome-check.md) — the Biome proxy tool.
- [repos-tools.md](./repos-tools.md) — the vendored-repo tools.
- [silk-effects/architecture.md](../silk-effects/architecture.md) — the services every tool wraps.
- [cli/architecture.md](../cli/architecture.md) — the sibling host with its own runtime stack.
- [silk/plugin.md](../silk/plugin.md) — the plugin that spawns and orients this server.
