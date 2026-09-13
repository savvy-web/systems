---
type: Module
title: mcp
description: The savvy-mcp server — a standalone, spawnable, tools-only MCP server serving Silk Suite tooling to coding agents as structured tools.
kind: package
resource: ../../packages/mcp
status: draft
tags: [architecture, tooling]
sources:
  - id: arch
    resource: ../../packages/mcp/src
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: c9839fc1c3ec86de463533747efa106b9baf08ffc8aa2a95807d7a39e4e6302b
---

# mcp

## Boundary

`@savvy-web/mcp` (`packages/mcp`) owns the `savvy-mcp` binary: a long-lived MCP server, spawned alongside an agent in the project working directory and shared across Claude Code plugins. It exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output instead of parsed console text.[^arch]

It is a tools-only server: one Effect `Layer`, a ten-tool `Toolkit` from `effect/unstable/ai` registered against `McpServer.layerStdio`, zero resources, no MCP SDK, no zod. Tool logic comes from [`silk-effects`](silk-effects.md), the same business layer the `savvy` CLI uses; the tool files are glue. It is not a discovery host and carries no per-project gating — direction lives in the plugins that spawn it.[^arch] It is an L3 front end in the package layering, a peer of [`cli`](cli.md) that never imports it.[^arch]

The choice to build this server Effect-native, over `effect/unstable/ai`'s `McpServer` rather than the reference SDK, is recorded in [effect-native-mcp-server](../decisions/effect-native-mcp-server.md). The ten tools' individual contracts are documented from the consumer side in [savvy-mcp-tools](../interfaces/savvy-mcp-tools.md), and the shape every tool follows (Effect Schema as canon, `Tool.make` with declared dependencies, read-only versus mutating annotation) is in [mcp-tool-authoring](../conventions/mcp-tool-authoring.md). This concept covers the module's boundary, ownership, and runtime wiring.

## Owner

Bound by [package-layering](../conventions/package-layering.md); shaped by [effect-native-mcp-server](../decisions/effect-native-mcp-server.md) and [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md).

## Entry points

The package follows the same `./main` contract as the CLI: `src/bin.ts` is the shebang shim, `src/main.ts` owns the process and is exported as `@savvy-web/mcp/main`, and `src/index.ts` is the side-effect-free barrel — it never exports `main`, so importing it registers no crash guards and imports no server graph.[^arch] `main()` registers `uncaughtException`/`unhandledRejection` handlers before dynamically importing anything reachable from the tool surface, so an import-time failure is reported by a handler instead of crashing before one exists, then launches the server layer under `NodeRuntime.runMain` with a custom teardown that maps success-or-interrupts-only to exit 0.[^arch]

## The runtime layer

One long-lived service graph, built from `makeSilkRuntimeLayer(cwd)` and composed directly from silk-effects and `@effected/*` kit exports — both of which mcp may import, so the layering holds without indirection. The composition rests on one reference, one construction: the kit graph (`Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd })`) mints a fresh layer per call, so it is bound to a `const` and provided once via `Layer.provideMerge`; layer memoization by reference then builds each kit service exactly once, root-bound to the resolved project dir.[^arch] Because these instances live as long as the process, caches (`Changesets.ConfigInspector`, `ToolDiscovery`'s binary-probe cache) are refreshed per call rather than per layer build.[^arch]

`DepsRegen` is gated by silk's `SilkPublishability.layerAdaptive`, provided closer than the kit graph so it wins over the kit's npm-semantics default.[^arch]

## Root resolution

`main()` resolves its base directory through `resolveProjectDir(argv, env, cwd)` by precedence `argv[2]` → `SAVVY_MCP_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()`. Because dev tooling launches the server from `packages/mcp/` rather than the repo root, every Effect-backed tool handler additionally resolves the true workspace root by walking up from the base dir via `WorkspaceRoot.find` before doing anything, so the tools work from any subdirectory — except `biome_check`, which mutates and resolves a containment root instead.[^arch]

## Plugin integration

A plugin declares the server via an `mcpServers` block in its `.claude-plugin/plugin.json` whose command runs a launcher that execs the project's own installed `savvy-mcp` binary, falling back to `npx --yes @savvy-web/mcp`, and exports the project dir as both `CLAUDE_PROJECT_DIR` and `SAVVY_MCP_PROJECT_DIR`. `plugins/silk` is the only plugin in this repository that does so. Information lives in the server; direction lives in the plugin — a spawning plugin adds its own orientation hooks pointing the agent at the tools it should prefer, since the shared server carries every tool regardless of the current project.[^arch]

## Boundaries and invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from silk-effects and the `@effected/*` kit; the `@e2e/workspace` DAG check asserts it.[^arch]
- **`src/index.ts` never exports `main`.**[^arch]
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency here, not bundled — the opposite of `@savvy-web/silk`'s CJS-bundling requirement.[^arch]
- **Effect Schema is the only schema language.** Parameters, results, and the failure union are Effect `Schema`; the framework derives the wire JSON Schema. No zod, no bridge.[^arch]
- **stdout is the JSON-RPC wire; logs go to stderr; a clean disconnect exits 0.**[^arch]
- **Read-only is the convention; `biome_check`, `changeset_deps_regen`, and `repos_manage` are the three documented exceptions.** See [savvy-mcp-tools](../interfaces/savvy-mcp-tools.md).[^arch]
- **The runtime is root-bound at layer build.** One server instance serves one project dir; per-call `cwd` arguments walk up to a workspace root but do not rebuild the layer.[^arch]

## Related concepts

- [silk-effects](silk-effects.md) — the engine every tool handler delegates to
- [cli](cli.md) — the sibling L3 front end
- [effect-native-mcp-server](../decisions/effect-native-mcp-server.md) — why this server is Effect-native
- [savvy-mcp-tools](../interfaces/savvy-mcp-tools.md) — the ten tools' consumer-side contracts
- [mcp-tool-authoring](../conventions/mcp-tool-authoring.md) — how a tool is shaped and tested
- [package-layering](../conventions/package-layering.md) — the layering rule this package's non-import invariant enforces

[^arch]: `../../packages/mcp/src`
