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
  - id: repos-manage
    resource: ../../packages/mcp/src/tools/repos-manage.ts
  - id: errors
    resource: ../../packages/mcp/src/errors.ts
  - id: main
    resource: ../../packages/mcp/src/main.ts
  - id: harness
    resource: ../../packages/mcp/__test__/utils/harness.ts
  - id: issue-700
    resource: https://github.com/savvy-web/systems/issues/700
generated:
  by: okfit/claude-code
  at: 2026-09-26T23:41:51Z
  body_sha256: c6ebe09a9b65b20d33f3dd37d842811fd2f99904204b2fdb21996223519f29a3
---

# An Effect-native MCP server

## Context

The previous `@savvy-web/mcp` server built an SDK `McpServer` (`@modelcontextprotocol/sdk`), registered each tool with a zod input schema and a bridged `outputSchema` (`Schema.toJsonSchemaDocument` → inlined `$ref`s → `z.fromJSONSchema`), and ran handlers through a `ManagedRuntime`. It worked, but it carried a second schema language at the wire boundary, a bridge normalizing Effect's JSON Schema deltas against zod's, and two dependencies (the SDK, zod) whose only job was serialization. Effect v4 ships an MCP server in core (`effect/unstable/ai`'s `McpServer`), implemented against savvy-web/systems#632.[^decision] Until savvy-web/systems#688 the server registered through a local port of core's `registerToolkit` so it could put a markdown transcript in `content[0].text`; a probe on Claude Code 2.1.280 showed Claude Code forwards only `structuredContent` to the model when a result carries one, so that transcript reached no model and was retired with the port.[^issue-688]

## Decision

`@savvy-web/mcp` is one `Layer`: a `Toolkit` of ten `Tool.make` values registered against `@effected/mcp`'s `McpStdio.layer` (core's `McpServer.layerStdio` plus the kit's protocol defaults, stderr logging and stdin guard — see [front-ends-adopt-effected-kit](front-ends-adopt-effected-kit.md)), with the silk-effects runtime layer discharging every handler's declared dependencies. Registration is `@effected/mcp`'s `McpToolkit.layer(SilkToolkit, { strict: "annotated" })` — core's `registerToolkit` plus a clearer unknown-argument report for strict tools — so each tool's success schema stays exactly the shared [silk-effects](../modules/silk-effects.md) result type (or its documented flat projection), untouched by an MCP-only field. A success is rendered by core and nothing else: `structuredContent` is the encoded typed result and `content[0].text` is that same object as JSON. There is no separate text projection; the result schema is the whole contract.[^decision]

The cost is borne by clients that show `content` rather than `structuredContent` (Cursor, Copilot, MCP Apps hosts): they now see JSON where they used to see a readable transcript. That trade is accepted because the model, not a human, is the audience that matters, and Claude Code hands the model `structuredContent` alone; revisit it if MCP adopts per-audience result variants (SEP-3279).[^issue-688]

`strict: "annotated"` with no tool annotated `Tool.Strict` keeps every `Tool.make` tool lenient. That is a deliberate, conservative default, not a response to observed client behaviour: MCP carries `_meta` at `params._meta`, which core reads separately from `arguments`, and no client-injected argument extras have been observed — on 2026-09-26 Claude Code called a strict tool (`additionalProperties: false`, unknown keys rejected) in another server without error. Strictness is a per-tool opt-in, and `repos_manage` is already strict through `McpToolkit.unionTool`. `__test__/server.strict.test.ts` pins both halves through the served registration path: a strict fixture tool rejects an excess property and serves `additionalProperties: false`, and its lenient sibling accepts the extra.[^strict-test]

The input schema must be object-rooted (`McpSchema.ToolJson` requires a `type: "object"` root). `outputSchema` is served only for an object-rooted success schema — core's behaviour since rc.117, and what the MCP TypeScript SDK's `ToolSchema` requires, so an `anyOf`-rooted document would break `tools/list` in strict clients. The four tools with discriminated-union results (`turbo_inspect`, `changeset_inspect`, `repos_inspect`, `repos_manage`) wrap them in `@effected/mcp`'s `ToolOutputSchema.objectRooted`, which adds `type: "object"` beside the `anyOf`, so all ten tools serve an `outputSchema`.[^decision]

`repos_manage`'s parameters are a union too — one struct per action — so it is a `McpToolkit.unionTool` rather than a `Tool.make`: served as a strict `oneOf` keyed by `action` (`additionalProperties: false` on every member) and decoded by `McpToolkit.unionHandler`, it rejects a missing field or a key the chosen action does not take as invalid parameters before the handler runs, whatever `strict` says for the other tools. Like any parameter failure, that is an `isError` result on `2025-11-25` and `2026-07-28` and a JSON-RPC `-32602` on `2025-06-18`.[^repos-manage] It replaced a flat wire struct whose handler re-decoded the arguments into an internal tagged union (savvy-web/systems#700).[^issue-700]

The error model is one typed failure union, `McpToolError` (`WorkspaceNotFound | EngineError | BiomeFailed | ToolRefusal`), every member folding its remediation hint into `message` at construction — a structured `remediation` field would be invisible to a real client because a caught declared failure reaches the wire as message text only.[^front-end-kit] The three local members carry a field of their own and spread `@effected/mcp`'s `ToolFailure.fields`, composing `message` through `ToolFailure.message` (echoed caller values pass through `ToolFailure.truncate`); a refusal with nothing beyond its message — a bad argument, a path escaping the workspace, a missing Biome binary — is the kit's `ToolRefusal`, built with `ToolRefusal.refuse(reason, remediation)`.[^errors] Every tool uses `failureMode: "error"`.[^decision]

`instructions` is a first-class `layerStdio` option, passed through `McpStdio.layer`, and the server registers `SERVER_INSTRUCTIONS` (exported from `server.ts`): the agent-facing orientation — what the server is for, which tool to reach for first, the traps — surfaced in both the `initialize` result on the stateful protocols and the `server/discover` result on `2026-07-28`. `description` stays the one-line human summary. The in-process suite asserts the instructions on both paths.[^decision]

Six framework gotchas were verified against `effect@4.0.0-rc.117` (the `server.ts` header carries the current list) and are load-bearing on the implementation: (1) `Tool.make` needs an explicit `dependencies` array or `Tool.HandlerServices` infers `never`; (2) `protocols` order in `ServerLayer` is load-bearing, more so since rc.116 — the runtime (`unstable/ai/internal/mcpRuntime.ts`) routes a request carrying `_meta["io.modelcontextprotocol/protocolVersion"]` to that adapter, matches `initialize` against the STATEFUL adapters only, and sends anything else with no session to `protocols[0]`; at most one stateless adapter is allowed (a second fails the layer with `Cause.IllegalArgumentError`). The list is `[v2026_07_28, v2025_11_25, v2025_06_18]` — exactly `McpStdio.layer`'s default, so `ServerLayer` no longer spells it out: the stateless `2026-07-28` adapter (SEP-2575 — no `initialize`, no session, discovery via `server/discover`) first, then the two newest stateful ones. Empirically (2026-09-19, Claude Code 2.1.278, server stdin tee'd to a file), Claude Code opens a stdio server with `initialize` on `2025-11-25` unless `MCP_PROTOCOL_NEGOTIATION=auto` is set, in which case it opens with `server/discover` on `2026-07-28`; a settings-file `env` entry for that variable overrides a shell export, which is how a first measurement wrongly read the stateless path as unconditional. The stateful adapters therefore remain the default path for Claude Code, Copilot, Cursor and the Inspector, all of which send `initialize` — a server offering only `2026-07-28` answers those with `METHOD_NOT_FOUND`. Never drop them. (3) A declared typed failure reaches the wire as message text only, never `structuredContent`: under `failureMode: "error"` core's `registerToolkit` collapses an `Error`-shaped declared failure to `{ isError: true, content: [{ type: "text", text: error.message }] }`, so `errors.ts` composes every member's message at construction. A declared failure is not logged — it is a result the model reads, not an incident — so a failing call leaves stderr empty. (4) `Logger.consolePretty`'s `stderr` option is still inert — the real switch is `References.LogToStderr`, or every log line lands on stdout, the JSON-RPC wire; now handled by the kit, since `McpStdio.layer` merges it into its output and `McpStdio.launch` provides it around the whole program. (5) A clean stdin close exits 130 by default; now handled by the kit, since `McpGuard.run` launches with `McpStdio.teardown`, which maps stdin EOF to exit 0 (a `tools/call` still in flight when stdin closes is interrupted and its response never written, yet the exit is still 0). (6) A resource URI template's parametric segment cannot span a `/` — not yet exercised, since this server registers no resources.[^decision]

Testing runs three tiers: structural (plain `vitest`, imports `SilkToolkit` with no bin and no platform layer), in-process (`@effect/vitest`, the real `ServerLayer(cwd)` driven through `@effected/mcp/testing`'s `McpHarness` with no child process — `__test__/utils/harness.ts` is only a `makeHarness` wrapper that provides `PlatformWithoutStdio`, `NodeServices.layer` minus the `Stdio` that would shadow the harness's queue-backed one[^harness]; `__test__/server.harness.test.ts` covers the `-32700` stdin guard, the distribution suffix in `serverInfo.version`, and the tools' leniency toward extra arguments), and e2e (spawning the built `savvy-mcp.js` binary through the kit's `McpProcess`/`McpProbe`). The in-process suite in `__test__/server.test.ts` also covers `server/discover` on `2026-07-28` (`supportedVersions` lists all three adapters, stateless first; the instructions; the server identity), `tools/list` with no handshake, and a per-revision envelope matrix (`2026-07-28` / `2025-11-25` / `2025-06-18`) for a success, a declared failure and an invalid-params call — on `2025-06-18` the runtime surfaces invalid params as a JSON-RPC `-32602` rather than an `isError` result, a split that is the framework's, by protocol version. Its success round trips, struct-rooted (`workspace_info`, per revision) and union-rooted (`repos_inspect`), check that `content[0].text` is exactly the `structuredContent` object as JSON, and it asserts `repos_manage`'s served `oneOf` and its rejection of a missing field and a stray key. `__test__/server.strict.test.ts` registers a fixture toolkit through the same `McpToolkit.layer(..., { strict: "annotated" })` over `McpStdio.layer`, and the harness accepts that fixture server layer. The e2e lifecycle suite asserts `content[0].text` is the `structuredContent` object as JSON on a real `workspace_info` call, pins gotcha 4 and the unlogged declared failure (gotcha 3) by asserting empty stderr across a full handshake and a declared failure, and gotcha 5 by asserting exit 0 on stdin close; `__test__/boundaries.test.ts` pins that only `main.ts` touches `process` (allowed wholesale), `version.ts` is waived for the single `process.env.__PACKAGE_VERSION__` token through `allowRules`, and `bin.ts` may not touch `process` at all.[^decision]

## Alternatives rejected

- **Keep the SDK.** Two schema languages at the boundary, a bridge whose only job was undoing Effect's JSON Schema encoding, and zod as a runtime dependency for what is a serialization concern. With `McpServer` in Effect core the whole package becomes a layer graph and the tool values become plain data a structural test can import with no bin and no platform.[^decision]
- **Keep a markdown transcript in `content[0].text` through a local port of `registerToolkit`.** Core's registration renders every success as JSON and exposes no hook over the text, so a readable transcript needed a mirror of `registerToolkit` over `McpServer.addTool` plus a markdown projection per tool — a mirror that tracked framework internals on every rc bump. It bought nothing for the audience that matters: Claude Code forwards only `structuredContent` to the model when present, so the transcript reached no model.[^issue-688]
- **A `markdown` field on every result schema.** Carrying the transcript inside `structuredContent` would reach the model, but it changes every result shape, puts an MCP-only field on shared silk-effects result schemas, and makes the model read every result twice, once as fields and once as prose.[^decision]

## Consequences

- Registration and success rendering are core's and the kit's; an `effect` rc bump re-checks the six gotchas in the `server.ts` header, not a local mirror. The round-trip tests fail if the text channel ever stops being the `structuredContent` object as JSON.
- A client that renders `content` for a human (Cursor, Copilot, MCP Apps hosts) shows JSON; revisit if MCP adopts per-audience result variants (SEP-3279).[^issue-688]
- With no markdown there is nothing to escape, so repository-derived strings (file names, package names, vendored-repo metadata) reach the client as JSON string values with no escaping layer and no escaping tests.
- The SDK, zod, the JSON-Schema bridge, and the inspector devDependency are gone from [mcp](../modules/mcp.md); Effect Schema is the only schema language at the tool boundary.
- `main.ts` must stay a single `@effected/mcp/guard` `McpGuard.run` call whose `load` dynamically imports everything reachable from the tool surface, so the guard's `uncaughtException`/`unhandledRejection` listeners exist before any of it evaluates; the guard launches through `McpStdio.launch`/`McpStdio.teardown`, which is what keeps gotchas 4 and 5 handled.[^main]
- A future resource addition must register static per-item resources at boot rather than a nested-id URI template, per gotcha 6.

[^decision]: `../../packages/mcp/src/server.ts`
[^front-end-kit]: [front-ends-adopt-effected-kit](front-ends-adopt-effected-kit.md)
[^issue-688]: <https://github.com/savvy-web/systems/issues/688>
[^strict-test]: `../../packages/mcp/__test__/server.strict.test.ts`
[^repos-manage]: `../../packages/mcp/src/tools/repos-manage.ts`
[^errors]: `../../packages/mcp/src/errors.ts`
[^main]: `../../packages/mcp/src/main.ts`
[^harness]: `../../packages/mcp/__test__/utils/harness.ts`
[^issue-700]: <https://github.com/savvy-web/systems/issues/700>
