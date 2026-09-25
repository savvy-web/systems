---
type: Decision
title: An Effect-native MCP server
description: "@savvy-web/mcp runs on effect/unstable/ai's McpServer instead of the @modelcontextprotocol/sdk, registering its toolkit through @effected/mcp's McpToolkit so every success is the typed result in structuredContent with the same object as JSON in content[0].text."
status: draft
tags: [architecture, tooling]
sources:
  - id: decision
    resource: ../../packages/mcp/src/server.ts
  - id: front-end-kit
    resource: front-ends-adopt-effected-kit.md
  - id: issue-688
    resource: https://github.com/savvy-web/systems/issues/688
  - id: strict-test
    resource: ../../packages/mcp/__test__/server.strict.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-25T02:26:25Z
  body_sha256: 53595b9dd0a6fd6c4e81b0fafcfd5e9c808c60664c35a5839bdcce16da1bbf74
---

# An Effect-native MCP server

## Context

The previous `@savvy-web/mcp` server built an SDK `McpServer` (`@modelcontextprotocol/sdk`), registered each tool with a zod input schema and a bridged `outputSchema` (`Schema.toJsonSchemaDocument` → inlined `$ref`s → `z.fromJSONSchema`), and ran handlers through a `ManagedRuntime`. It worked, but it carried a second schema language at the wire boundary, a bridge normalizing Effect's JSON Schema deltas against zod's, and two dependencies (the SDK, zod) whose only job was serialization. Effect v4 ships an MCP server in core (`effect/unstable/ai`'s `McpServer`), implemented against savvy-web/systems#632.[^decision] Until savvy-web/systems#688 the server registered through a local port of core's `registerToolkit` so it could put a markdown transcript in `content[0].text`; a probe on Claude Code 2.1.280 showed Claude Code forwards only `structuredContent` to the model when a result carries one, so that transcript reached no model and was retired with the port.[^issue-688]

## Decision

`@savvy-web/mcp` is one `Layer`: a `Toolkit` of ten `Tool.make` values registered against `@effected/mcp`'s `McpStdio.layer` (core's `McpServer.layerStdio` plus the kit's protocol defaults, stderr logging and stdin guard — see [front-ends-adopt-effected-kit](front-ends-adopt-effected-kit.md)), with the silk-effects runtime layer discharging every handler's declared dependencies. Registration is `@effected/mcp`'s `McpToolkit.layer(SilkToolkit, { strict: "annotated" })` — core's `registerToolkit` plus a clearer unknown-argument report for strict tools — so each tool's success schema stays exactly the shared [silk-effects](../modules/silk-effects.md) result type (or its documented flat projection), untouched by an MCP-only field. A success is rendered by core and nothing else: `structuredContent` is the encoded typed result and `content[0].text` is that same object as JSON. There is no separate text projection; the result schema is the whole contract.[^decision]

The cost is borne by clients that show `content` rather than `structuredContent` (Cursor, Copilot, MCP Apps hosts): they now see JSON where they used to see a readable transcript. That trade is accepted because the model, not a human, is the audience that matters, and Claude Code hands the model `structuredContent` alone; revisit it if MCP adopts per-audience result variants (SEP-3279).[^issue-688]

`strict: "annotated"` with no tool annotated `Tool.Strict` keeps every served tool lenient, since Claude Code sends `_meta`-style extras on some calls; strictness is a per-tool opt-in. `__test__/server.strict.test.ts` pins both halves through the served registration path: a strict fixture tool rejects an excess property and serves `additionalProperties: false`, and its lenient sibling accepts the extra.[^strict-test]

The input schema must be object-rooted (`McpSchema.ToolJson` requires a `type: "object"` root). `outputSchema` is served only for an object-rooted success schema — core's behaviour since rc.117, and what the MCP TypeScript SDK's `ToolSchema` requires, so an `anyOf`-rooted document would break `tools/list` in strict clients. Four tools with discriminated-union results (`turbo_inspect`, `changeset_inspect`, `repos_inspect`, `repos_manage`) are `anyOf`-rooted and serve no `outputSchema`, with `structuredContent` unaffected.[^decision]

The error model is one typed failure union, `McpToolError` (`WorkspaceNotFound | InvalidArgument | EngineError | BiomeUnavailable | BiomeFailed`), every member spreading `@effected/mcp`'s `ToolFailure.fields` and folding its remediation hint into `message` at construction through `ToolFailure.message` (echoed caller values pass through `ToolFailure.truncate`) — a structured `remediation` field would be invisible to a real client because a caught declared failure reaches the wire as message text only.[^front-end-kit] Every tool uses `failureMode: "error"`.[^decision]

`instructions` is a first-class `layerStdio` option, passed through `McpStdio.layer`, and the server registers `SERVER_INSTRUCTIONS` (exported from `server.ts`): the agent-facing orientation — what the server is for, which tool to reach for first, the traps — surfaced in both the `initialize` result on the stateful protocols and the `server/discover` result on `2026-07-28`. `description` stays the one-line human summary. The in-process suite asserts the instructions on both paths.[^decision]

Six framework gotchas were verified against `effect@4.0.0-rc.117` (the `server.ts` header carries the current list) and are load-bearing on the implementation: (1) `Tool.make` needs an explicit `dependencies` array or `Tool.HandlerServices` infers `never`; (2) `protocols` order in `ServerLayer` is load-bearing, more so since rc.116 — the runtime (`unstable/ai/internal/mcpRuntime.ts`) routes a request carrying `_meta["io.modelcontextprotocol/protocolVersion"]` to that adapter, matches `initialize` against the STATEFUL adapters only, and sends anything else with no session to `protocols[0]`; at most one stateless adapter is allowed (a second fails the layer with `Cause.IllegalArgumentError`). The list is `[v2026_07_28, v2025_11_25, v2025_06_18]` — exactly `McpStdio.layer`'s default, so `ServerLayer` no longer spells it out: the stateless `2026-07-28` adapter (SEP-2575 — no `initialize`, no session, discovery via `server/discover`) first, then the two newest stateful ones. Empirically (2026-09-19, Claude Code 2.1.278, server stdin tee'd to a file), Claude Code opens a stdio server with `initialize` on `2025-11-25` unless `MCP_PROTOCOL_NEGOTIATION=auto` is set, in which case it opens with `server/discover` on `2026-07-28`; a settings-file `env` entry for that variable overrides a shell export, which is how a first measurement wrongly read the stateless path as unconditional. The stateful adapters therefore remain the default path for Claude Code, Copilot, Cursor and the Inspector, all of which send `initialize` — a server offering only `2026-07-28` answers those with `METHOD_NOT_FOUND`. Never drop them. (3) A declared typed failure reaches the wire as message text only, never `structuredContent`: under `failureMode: "error"` core's `registerToolkit` collapses an `Error`-shaped declared failure to `{ isError: true, content: [{ type: "text", text: error.message }] }`, so `errors.ts` composes every member's message at construction. A declared failure is not logged — it is a result the model reads, not an incident — so a failing call leaves stderr empty. (4) `Logger.consolePretty`'s `stderr` option is still inert — the real switch is `References.LogToStderr`, or every log line lands on stdout, the JSON-RPC wire; now handled by the kit, since `McpStdio.layer` merges it into its output and `McpStdio.launch` provides it around the whole program. (5) A clean stdin close exits 130 by default; now handled by the kit, since `main.ts` passes `McpStdio.teardown`, which maps stdin EOF to exit 0 (a `tools/call` still in flight when stdin closes is interrupted and its response never written, yet the exit is still 0). (6) A resource URI template's parametric segment cannot span a `/` — not yet exercised, since this server registers no resources.[^decision]

Testing runs three tiers: structural (plain `vitest`, imports `SilkToolkit` with no bin and no platform layer), in-process (`@effect/vitest`, the real `ServerLayer(cwd)` driven through a stdio test harness with no child process — `__test__/server.test.ts` over `Stdio.layerTest`, and `__test__/server.harness.test.ts` over `@effected/mcp/testing`'s `McpHarness`, which covers the `-32700` stdin guard, the distribution suffix in `serverInfo.version`, and the tools' leniency toward extra arguments), and e2e (spawning the built `savvy-mcp.js` binary through the kit's `McpProcess`/`McpProbe`). The in-process suite in `__test__/server.test.ts` also covers `server/discover` on `2026-07-28` (`supportedVersions` lists all three adapters, stateless first; the instructions; the server identity), `tools/list` with no handshake, and a per-revision envelope matrix (`2026-07-28` / `2025-11-25` / `2025-06-18`) for a success, a declared failure and an invalid-params call — on `2025-06-18` the runtime surfaces invalid params as a JSON-RPC `-32602` rather than an `isError` result, a split that is the framework's, by protocol version. Its success round trips, struct-rooted (`workspace_info`, per revision) and union-rooted (`repos_inspect`), check that `content[0].text` is exactly the `structuredContent` object as JSON. `__test__/server.strict.test.ts` registers a fixture toolkit through the same `McpToolkit.layer(..., { strict: "annotated" })` over `McpStdio.layer`, and the harness accepts that fixture server layer. The e2e lifecycle suite asserts `content[0].text` is the `structuredContent` object as JSON on a real `workspace_info` call, pins gotcha 4 and the unlogged declared failure (gotcha 3) by asserting empty stderr across a full handshake and a declared failure, and gotcha 5 by asserting exit 0 on stdin close; `__test__/boundaries.test.ts` pins that only `bin.ts`, `main.ts` and `version.ts` touch `process`.[^decision]

## Alternatives rejected

- **Keep the SDK.** Two schema languages at the boundary, a bridge whose only job was undoing Effect's JSON Schema encoding, and zod as a runtime dependency for what is a serialization concern. With `McpServer` in Effect core the whole package becomes a layer graph and the tool values become plain data a structural test can import with no bin and no platform.[^decision]
- **Keep a markdown transcript in `content[0].text` through a local port of `registerToolkit`.** Core's registration renders every success as JSON and exposes no hook over the text, so a readable transcript needed a mirror of `registerToolkit` over `McpServer.addTool` plus a markdown projection per tool — a mirror that tracked framework internals on every rc bump. It bought nothing for the audience that matters: Claude Code forwards only `structuredContent` to the model when present, so the transcript reached no model.[^issue-688]
- **A `markdown` field on every result schema.** Carrying the transcript inside `structuredContent` would reach the model, but it changes every result shape, puts an MCP-only field on shared silk-effects result schemas, and makes the model read every result twice, once as fields and once as prose.[^decision]

## Consequences

- Registration and success rendering are core's and the kit's; an `effect` rc bump re-checks the six gotchas in the `server.ts` header, not a local mirror. The round-trip tests fail if the text channel ever stops being the `structuredContent` object as JSON.
- A client that renders `content` for a human (Cursor, Copilot, MCP Apps hosts) shows JSON; revisit if MCP adopts per-audience result variants (SEP-3279).[^issue-688]
- With no markdown there is nothing to escape, so repository-derived strings (file names, package names, vendored-repo metadata) reach the client as JSON string values with no escaping layer and no escaping tests.
- The SDK, zod, the JSON-Schema bridge, and the inspector devDependency are gone from [mcp](../modules/mcp.md); Effect Schema is the only schema language at the tool boundary.
- `main.ts` must register `uncaughtException`/`unhandledRejection` handlers before dynamically importing anything reachable from the tool surface — the kit does not package that pattern — and must launch through `McpStdio.launch`/`McpStdio.teardown`, or gotchas 4 and 5 return.
- A future resource addition must register static per-item resources at boot rather than a nested-id URI template, per gotcha 6.

[^decision]: `../../packages/mcp/src/server.ts`
[^front-end-kit]: [front-ends-adopt-effected-kit](front-ends-adopt-effected-kit.md)
[^issue-688]: <https://github.com/savvy-web/systems/issues/688>
[^strict-test]: `../../packages/mcp/__test__/server.strict.test.ts`
