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
  - id: main
    resource: ../../packages/mcp/src/main.ts
  - id: server
    resource: ../../packages/mcp/src/server.ts
  - id: tests
    resource: ../../packages/mcp/__test__
  - id: errors
    resource: ../../packages/mcp/src/errors.ts
  - id: repos-manage
    resource: ../../packages/mcp/src/tools/repos-manage.ts
  - id: layering
    resource: ../../packages/silk/__test__/package-layering.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-26T23:41:51Z
  body_sha256: 1c9f9d4d2b61cc7df65db991e614cac78558761d10a3f0852289e262fcd54db9
---

# mcp

## Boundary

`@savvy-web/mcp` (`packages/mcp`) owns the `savvy-mcp` binary: a long-lived MCP server, spawned alongside an agent in the project working directory and shared across Claude Code plugins. It exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output instead of parsed console text.[^arch]

It is a tools-only server: one Effect `Layer`, a ten-tool `Toolkit` from `effect/unstable/ai` registered by `@effected/mcp`'s `McpToolkit.layer` against its `McpStdio.layer` (core's `McpServer.layerStdio` with the kit's protocol defaults), zero resources, no MCP SDK, no zod. A success carries the typed result in `structuredContent` and the same object as JSON in `content[0].text`; there is no markdown or other text projection. Every tool serves an `outputSchema`: the four whose results are discriminated unions wrap them in `@effected/mcp`'s `ToolOutputSchema.objectRooted`, since core serves one only for an object-rooted schema.[^server] Nine tools are `Tool.make` values, lenient toward extra arguments as a deliberate, conservative default; `repos_manage`, whose parameters are one struct per action, is a `McpToolkit.unionTool` served as a strict `oneOf` keyed by `action`, so a missing field or a stray key is rejected as invalid parameters before its handler runs — an `isError` result on `2025-11-25`/`2026-07-28`, a JSON-RPC `-32602` on `2025-06-18`.[^repos-manage] A declared failure is one of `McpToolError`'s members — `WorkspaceNotFound`, `EngineError`, `BiomeFailed`, or the kit's `ToolRefusal` (built with `ToolRefusal.refuse`) for a refusal that carries nothing beyond its message — and reaches the wire as `isError` text.[^errors] Tool logic comes from [`silk-effects`](silk-effects.md), the same business layer the `savvy` CLI uses; the tool files are glue. It is not a discovery host and carries no per-project gating — direction lives in the plugins that spawn it.[^arch] It is an L3 front end in the package layering, a peer of [`cli`](cli.md) that never imports it.[^arch]

The choice to build this server Effect-native, over `effect/unstable/ai`'s `McpServer` rather than the reference SDK, is recorded in [effect-native-mcp-server](../decisions/effect-native-mcp-server.md). The ten tools' individual contracts are documented from the consumer side in [savvy-mcp-tools](../interfaces/savvy-mcp-tools.md), and the shape every tool follows (Effect Schema as canon, the result schema as the whole wire contract, `Tool.make` with declared dependencies, read-only versus mutating annotation) is in [mcp-tool-authoring](../conventions/mcp-tool-authoring.md). This concept covers the module's boundary, ownership, and runtime wiring.

## Owner

Bound by [package-layering](../conventions/package-layering.md); shaped by [effect-native-mcp-server](../decisions/effect-native-mcp-server.md), [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md) and [front-ends-adopt-effected-kit](../decisions/front-ends-adopt-effected-kit.md).

## Entry points

The package follows the same `./main` contract as the CLI: `src/bin.ts` is the shebang shim, `src/main.ts` owns the process and is exported as `@savvy-web/mcp/main`, and `src/index.ts` is the side-effect-free barrel — it never exports `main`, so importing it registers no crash guards and imports no server graph.[^arch] `main()` is one `@effected/mcp/guard` `McpGuard.run({ label: "savvy-mcp", host: process, load })` call, and the guard and an erased type are its only static imports. The guard registers `uncaughtException`/`unhandledRejection` listeners, then awaits `load`, which dynamically imports the whole server graph, resolves the project dir, and returns `ServerLayer(cwd, options)` with `NodeRuntime.runMain`; an import-time failure is reported on stderr by the guard instead of crashing before a handler exists, and a rejected `load` exits 1. The guard launches the layer through `McpStdio.launch`, which reports a launch failure on stderr, never onto the wire, with `McpStdio.teardown`, which maps stdin EOF — a clean disconnect — to exit 0.[^main] `main(options?: MainOptions)` takes an optional `distribution`; `ServerLayer(cwd, options?: ServerOptions)` renders it into `serverInfo.version` as `CURRENT_MCP_VERSION` plus `via <name> <version>`, which is how a server launched through silk's `savvy-mcp` shim names the carrier.[^main]

## The runtime layer

One long-lived service graph, built from `makeSilkRuntimeLayer(cwd)` and composed directly from silk-effects and `@effected/*` kit exports — both of which mcp may import, so the layering holds without indirection. The composition rests on one reference, one construction: the kit graph (`Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd })`) mints a fresh layer per call, so it is bound to a `const` and provided once via `Layer.provideMerge`; layer memoization by reference then builds each kit service exactly once, root-bound to the resolved project dir.[^arch] Because these instances live as long as the process, caches (`Changesets.ConfigInspector`, `ToolDiscovery`'s binary-probe cache) are refreshed per call rather than per layer build.[^arch]

`DepsRegen` is gated by silk's `SilkPublishability.layerAdaptive`, provided closer than the kit graph so it wins over the kit's npm-semantics default.[^arch]

## Root resolution

`main()` resolves its base directory through `@effected/engine`'s `LaunchContext.projectDir` by precedence first positional argument → `SAVVY_MCP_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()`, skipping an empty value or an unsubstituted `${VAR}` placeholder — which some launch paths pass through literally. Only the single positional is offered, so a stray flag cannot become the project directory.[^main] Because dev tooling launches the server from `packages/mcp/` rather than the repo root, every Effect-backed tool handler additionally resolves the true workspace root by walking up from the base dir via `WorkspaceRoot.find` before doing anything, so the tools work from any subdirectory — except `biome_check`, which mutates and resolves a containment root instead.[^arch]

## Plugin integration

A plugin declares the server via an `mcpServers` block in its `.claude-plugin/plugin.json` whose command runs a launcher that execs the project's own installed `savvy-mcp` binary, falling back to `npx --yes @savvy-web/mcp`, and exports the project dir as both `CLAUDE_PROJECT_DIR` and `SAVVY_MCP_PROJECT_DIR`. `plugins/silk` is the only plugin in this repository that does so. Information lives in the server; direction lives in the plugin — a spawning plugin adds its own orientation hooks pointing the agent at the tools it should prefer, since the shared server carries every tool regardless of the current project.[^arch]

## Boundaries and invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from silk-effects and the `@effected/*` kit; silk's package-layering test asserts the edge never exists.[^layering]
- **Only `main.ts` touches `process`.** It is the one file the `process` rules allow wholesale; `version.ts` is waived only for the single `process.env.__PACKAGE_VERSION__` token through `allowRules`, and `bin.ts` may not touch `process` at all. Everything below takes its facts as values; `__test__/boundaries.test.ts` pins it with `SourceBoundary`, and asserts the version token was actually waived.[^tests]
- **`src/index.ts` never exports `main`.**[^arch]
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency here, not bundled — the same posture every package in the repo now holds, including `@savvy-web/silk`.[^arch]
- **Effect Schema is the only schema language.** Parameters, results, and the failure union are Effect `Schema`; the framework derives the wire JSON Schema. No zod, no bridge.[^arch]
- **stdout is the JSON-RPC wire; logs go to stderr; a non-JSON stdin line gets a `-32700` reply and the server keeps serving; a clean disconnect exits 0.** All four are `McpStdio`'s, pinned end to end by `__test__/e2e/server-lifecycle.e2e.test.ts` over `@effected/mcp/testing`'s `McpProcess`/`McpProbe`, and in process over `McpHarness`, which every in-process suite drives through the thin `__test__/utils/harness.ts` wrapper — there is no hand-ported harness.[^tests]
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
[^main]: `../../packages/mcp/src/main.ts`
[^server]: `../../packages/mcp/src/server.ts`
[^tests]: `../../packages/mcp/__test__`
[^errors]: `../../packages/mcp/src/errors.ts`
[^repos-manage]: `../../packages/mcp/src/tools/repos-manage.ts`
[^layering]: `../../packages/silk/__test__/package-layering.test.ts`
