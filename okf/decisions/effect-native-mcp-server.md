---
type: Decision
title: An Effect-native MCP server
description: "@savvy-web/mcp runs on effect/unstable/ai's McpServer instead of the @modelcontextprotocol/sdk, registering tools through a local addTool mirror to keep the dual-channel (markdown + structured) result the framework's own toolkit registration cannot produce."
status: draft
tags: [architecture, tooling]
sources:
  - id: decision
    resource: ../../packages/mcp/src/server.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 65e73ca84b96fc2aacaaee1e16cb840897a628d49f1d0c230dbc5b729c801598
---

# An Effect-native MCP server

## Context

The previous `@savvy-web/mcp` server built an SDK `McpServer` (`@modelcontextprotocol/sdk`), registered each tool with a zod input schema and a bridged `outputSchema` (`Schema.toJsonSchemaDocument` → inlined `$ref`s → `z.fromJSONSchema`), and ran handlers through a `ManagedRuntime`. It worked, but it carried a second schema language at the wire boundary, a bridge normalizing Effect's JSON Schema deltas against zod's, and two dependencies (the SDK, zod) whose only job was serialization. Effect v4 ships an MCP server in core (`effect/unstable/ai`'s `McpServer`), implemented against savvy-web/systems#632.[^decision]

## Decision

`@savvy-web/mcp` is one `Layer`: a `Toolkit` of ten `Tool.make` values registered against `McpServer.layerStdio`, with the silk-effects runtime layer discharging every handler's declared dependencies. Registration goes through `registerSilkToolkit`, an ~80-line local port of rc.115's `McpServer.registerToolkit` that calls the framework's own public `McpServer.addTool` per tool rather than the toolkit-level registration path, so each tool's success schema stays exactly the shared [silk-effects](../modules/silk-effects.md) result type — untouched by an MCP-only field. Each tool carries its markdown renderer as a `SilkMarkdown` context annotation; the mirror reads it and puts the rendered transcript in `content[0].text` while `structuredContent` stays the encoded typed result, delivering the dual channel every tool promises.[^decision]

The mirror knowingly deviates from `registerToolkit` in three places, recorded as the baseline to re-check on the next rc bump: the success branch renders `SilkMarkdown` into `content[0].text` instead of `JSON.stringify(encodedResult)`; the success JSON Schema passes through a `hoistRootRef` step before the `type === "object"` check; and the mirror always emits one text item where the framework emits `content: []` for a `Schema.Void` success (moot today — every tool returns an object). In-process round trips in `__test__/server.test.ts` are the drift detector, asserting the markdown/JSON split holds; if a future rc exposes a text renderer on `registerToolkit`, `registerSilkToolkit` should be deleted in favor of `McpServer.toolkit(SilkToolkit)`.[^decision]

`outputSchema` is served only for struct-rooted results, since `McpSchema.ToolJsonSchema` requires a `type: "object"` root and `Schema.toJsonSchemaDocument` emits `$ref`-rooted documents for any identified schema; four tools with discriminated-union results (`turbo_inspect`, `changeset_inspect`, `repos_inspect`, `repos_manage`) are `anyOf`-rooted and serve no `outputSchema`, with `structuredContent` unaffected.[^decision]

The error model is one typed failure union, `McpToolError` (`WorkspaceNotFound | InvalidArgument | EngineError | BiomeUnavailable | BiomeFailed`), every member folding its remediation hint into `message` at construction — a structured `remediation` field would be invisible to a real client because a caught declared failure reaches the wire as message text only. Every tool uses `failureMode: "error"`.[^decision]

Six framework gotchas were verified against `effect@4.0.0-rc.115` and are load-bearing on the implementation: (1) `Tool.make` needs an explicit `dependencies` array or `Tool.HandlerServices` infers `never`; (2) `protocols` order in `ServerLayer` is load-bearing — an unrecognised client version negotiates to `protocols[0]`, so the list stays `[v2025_11_25, v2025_06_18]`, newest first; (3) a declared typed failure reaches the wire as message text only, never `structuredContent`; (4) `Logger.consolePretty`'s `stderr` option is inert in rc.115 — the real switch is `Logger.LogToStderr`, provided in `main.ts`, or every log line lands on stdout, the JSON-RPC wire; (5) a clean stdin close exits 130 unless `main.ts`'s custom teardown maps success-or-interrupts-only to 0; (6) a resource URI template's parametric segment cannot span a `/` — not yet exercised, since this server registers no resources.[^decision]

Testing runs three tiers: structural (plain `vitest`, imports `SilkToolkit` with no bin and no platform layer), in-process (`@effect/vitest`, the real `ServerLayer(cwd)` driven through a stdio test harness with no child process), and e2e (spawning the built `savvy-mcp.js` binary). The pinned gotcha-4 e2e is proven to fail — twice, for the record — when the `Logger.LogToStderr` provision is deleted from `main.ts` and the bin rebuilt, while the other three e2e cases stay green.[^decision]

## Alternatives rejected

- **Keep the SDK.** Two schema languages at the boundary, a bridge whose only job was undoing Effect's JSON Schema encoding, and zod as a runtime dependency for what is a serialization concern. With `McpServer` in Effect core the whole package becomes a layer graph and the tool values become plain data a structural test can import with no bin and no platform.[^decision]
- **`McpServer.toolkit(SilkToolkit)` with a `markdown` success field.** The framework's `registerToolkit` renders every success as `content: [{ type: "text", text: JSON.stringify(encodedResult) }]` plus `structuredContent`, with no hook over the text. Keeping the markdown transcript would mean extending every `*Result` schema with a `markdown: Schema.String` field carrying an `*AsMarkdown` projection — rejected because it changes every result shape and puts an MCP-only field on shared silk-effects result schemas. Registering through the public `McpServer.addTool` with a local mirror keeps the success schemas exactly the shared definitions.[^decision]

## Consequences

- The mirror tracks framework internals across rc bumps; the three-point drift baseline above must be re-checked at each bump, backed by the round-trip tests that fail when the mirror stops matching what the framework serves.
- The SDK, zod, the JSON-Schema bridge, and the inspector devDependency are gone from [mcp](../modules/mcp.md); Effect Schema is the only schema language at the tool boundary.
- `main.ts` must register `uncaughtException`/`unhandledRejection` handlers before dynamically importing anything reachable from the tool surface, and must provide `Logger.LogToStderr`, or gotcha 4 silently corrupts the JSON-RPC wire.
- A future resource addition must register static per-item resources at boot rather than a nested-id URI template, per gotcha 6.

[^decision]: `../../packages/mcp/src/server.ts`
