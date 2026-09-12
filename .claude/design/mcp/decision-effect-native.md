---
status: current
module: mcp
category: architecture
created: 2026-09-12
updated: 2026-09-12
last-synced: 2026-09-12
completeness: 92
related:
  - ./architecture.md
  - ./tools.md
  - ../workspace/package-layering.md
  - ../silk/plugin.md
  - ../testing/effect-vitest.md
dependencies:
  - ./architecture.md
---

# Decision: an Effect-native MCP server

Why `@savvy-web/mcp` runs on `effect/unstable/ai`'s `McpServer` instead of the `@modelcontextprotocol/sdk`, the alternatives that were rejected, the framework mirror that keeps the dual-channel result, and the six gotchas as verified against `effect@4.0.0-rc.115`. Implements savvy-web/systems#632; the sibling restructure is [package-layering.md](../workspace/package-layering.md) (#631). The server that resulted is described in [architecture.md](./architecture.md).

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Alternatives rejected](#alternatives-rejected)
- [The `addTool` mirror and its drift baseline](#the-addtool-mirror-and-its-drift-baseline)
- [Era-agnostic constraints](#era-agnostic-constraints)
- [The six gotchas, verified against rc.115](#the-six-gotchas-verified-against-rc115)
- [`outputSchema` only for struct-rooted results](#outputschema-only-for-struct-rooted-results)
- [The error model](#the-error-model)
- [Testing tiers](#testing-tiers)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

The previous server built an SDK `McpServer`, registered each tool with a zod input schema and a bridged `outputSchema` (`Schema.toJsonSchemaDocument` → inlined `$ref`s → `z.fromJSONSchema`), and ran handlers through a `ManagedRuntime`. It worked, but it carried a second schema language at the boundary, a bridge that had to normalize Effect's JSON Schema deltas, and two dependencies (`@modelcontextprotocol/sdk`, `zod`) whose only job was the wire. Effect v4 ships an MCP server in core. The server is now ONE `Layer`: a `Toolkit` of ten `Tool.make` values, registered against `McpServer.layerStdio`, with the silk-effects runtime layer discharging every handler's declared dependencies. The SDK, zod, the bridge and the inspector devDependency are gone.

## Current State

Shipped at `9c160a0b`. `packages/mcp/src/server.ts` is the authority — its header doc comment carries the constraints and gotchas below and is what this doc lifts from. The suite grew from 122 to 161 tests across the tiers in [Testing tiers](#testing-tiers), with nothing loosened; the pinned gotcha-4 e2e is proven to fail when the pin is removed.

## Alternatives rejected

- **Keep the SDK.** Rejected: two schema languages at the boundary, a bridge whose job was to undo Effect's JSON Schema encoding, and zod as a runtime dependency for what is a serialization concern. With `McpServer` in Effect core the whole package can be a layer graph, and the tool values become plain data a structural test can import with no bin and no platform.
- **`McpServer.toolkit(SilkToolkit)` with a `markdown` success field.** The framework's `registerToolkit` renders every success as `content: [{ type: "text", text: JSON.stringify(encodedResult) }]` plus `structuredContent` and offers no hook over the text (`McpServer.ts:1577-1585`). One way to keep the markdown transcript agents read is to extend every `*Result` schema with a `markdown: Schema.String` field carrying the `*AsMarkdown` projection. Rejected because it changes every result shape: `structuredContent` would carry a redundant markdown blob and the shared silk-effects result schemas would grow an MCP-only field. The chosen route — registering through the public `McpServer.addTool` with a local mirror — keeps the success schemas exactly the shared definitions, untouched.

## The `addTool` mirror and its drift baseline

`registerSilkToolkit` in `server.ts` is an ~80-line port of rc.115's `McpServer.registerToolkit` (`McpServer.ts:1525-1611`) that registers each tool through the public `McpServer.addTool`. Each tool carries its markdown renderer as a `SilkMarkdown` annotation (`src/markdown.ts`, a `Context.Service` keyed annotation over `(data: unknown) => string`); the mirror reads it and puts the rendered transcript in `content[0].text` while `structuredContent` stays the encoded typed result — the dual channel every tool description promises. Schema derivation, `Tool.Title` → `title`, `Tool.Meta` → `_meta`, annotation lifting and the `catchCause` ladder are a verbatim mirror and must stay one.

The accepted cost is that the mirror tracks framework internals across rc bumps. The **baseline for the next bump** — the three places it knowingly deviates from `registerToolkit`, to re-check against the new source — is recorded in the `server.ts` header:

1. the success branch renders the `SilkMarkdown` annotation as `content[0].text` instead of `JSON.stringify(encodedResult)`;
2. the success JSON Schema passes through `hoistRootRef` before the `type === "object"` check (see [below](#outputschema-only-for-struct-rooted-results));
3. the mirror always emits one text item, whereas the framework emits `content: []` for an `undefined` encoded result (a `Schema.Void` success) — moot here, every tool returns an object.

The in-process round trips in `__test__/server.test.ts` are the drift detector: they assert `content[0].text` starts with the markdown heading and is not JSON, and that `structuredContent` carries no `markdown` key. If a future rc exposes a text renderer on `registerToolkit`, delete `registerSilkToolkit` and use `McpServer.toolkit(SilkToolkit)`.

## Era-agnostic constraints

Every tool obeys these so a future protocol bump is a one-line `protocols` change in `ServerLayer`:

- no `initialize`-time state beyond what the framework keeps internally;
- no server-initiated requests;
- no reliance on sessions;
- paging carried in tool arguments (`limit`/`offset`), never a protocol-level cursor;
- every tool a pure request/response — no streaming, no elicitation.

## The six gotchas, verified against rc.115

The issue was filed against rc.112. Each was re-verified against `.repos/effect/packages/effect/src` at rc.115 (the installed version matches the vendored tag); source paths below are under that root.

| # | Gotcha | rc.115 finding | Where it is handled |
| --- | --- | --- | --- |
| 1 | `Tool.make` needs an explicit `dependencies` array | **Holds.** `Dependencies` defaults to `[]`, so `Tool.HandlerServices` infers `never` (`unstable/ai/Tool.ts:1200-1265`) and a handler that yields a service fails `Toolkit.HandlersFrom` (`Toolkit.ts:172-182`). | Every tool declares the services its handler yields; `biome_check` yields none and declares none. |
| 2 | `protocols` order is load-bearing | **Holds.** The stdio serialization selects `protocols.find(v === offered) ?? protocols[0]` on `initialize` (`McpServer.ts:1268-1271`), so an unrecognised client version negotiates to `protocols[0]`. rc.115 exports four adapters — `v2025_11_25`, `v2025_06_18`, `v2025_03_26`, `v2024_11_05` (`McpProtocol.ts:101-146`). | `ServerLayer` lists `[v2025_11_25, v2025_06_18]`, newest first; never reduce it to one. A probe offering `2026-01-01` was answered `2025-11-25`; the in-process test asserts a `2025-06-18` client negotiates down. |
| 3 | A declared typed failure reaches the wire as message text only | **Holds.** `registerToolkit` collapses a caught declared failure to `{ isError: true, content: [{ type: "text", text: error.message }] }` and never sets `structuredContent` for it (`McpServer.ts:1513-1517,1603-1607`). | `errors.ts` composes every member's `message` at construction and truncates echoed caller values; the mirror reproduces the branch exactly. The in-process test asserts `structuredContent === undefined` and the remediation text on a failing call. |
| 4 | `Logger.consolePretty`'s `stderr` option is inert | **Holds, and the option is gone from the signature** — rc.115 reads only `{ colors, formatDate, mode }` (`internal/effect.ts:6647-6651`). The real switch is `Logger.LogToStderr`, read at log time (`internal/effect.ts:6688,6832`). `registerToolkit` logs every failing call at error level (`McpServer.ts:1587`). | `main.ts` provides `Layer.succeed(Logger.LogToStderr, true)`. Without it every log line lands on stdout, the JSON-RPC wire. Pinned by the e2e described in [Testing tiers](#testing-tiers). |
| 5 | A clean stdin close exits 130 | **Holds.** `Runtime.defaultTeardown` returns 130 for an interrupts-only cause (`Runtime.ts:108-114`), which is what stdin EOF ending `layerStdio`'s scope produces. `NodeRuntime.runMain`'s `teardown` option, `Cause.hasInterruptsOnly` (`Cause.ts:624`) and `Runtime.defaultTeardown` all exist under those names. | `main.ts`'s custom teardown maps success-or-interrupts-only to 0 and defers the rest to the default. Corollary: a `tools/call` still in flight at EOF is interrupted, its response never written, and the exit is STILL 0 — the e2e helper therefore reads a call's response before closing stdin. |
| 6 | A resource URI template's parametric segment cannot span a `/` | **Not exercised** — this server registers no resources. | On record for the day one is added: register static per-item resources at boot rather than a nested-id template. |

Names verified under the brief's spellings: `Logger.LogToStderr` (`Logger.ts:185`), `Cause.hasInterruptsOnly`, `Runtime.defaultTeardown`, `runMain({ teardown })`, `Stdio.layerTest` (`Stdio.ts:152`). One adjacent finding, not an MCP gotcha but recorded because a brief had it wrong: `Context.Reference` in rc.115 is the plain function form `Reference(key, { defaultValue })`, not a class-factory — relevant to `Changesets.ChangesetLogMode` in silk-effects.

## `outputSchema` only for struct-rooted results

`McpSchema.ToolJsonSchema` requires a `type: "object"` root (`McpServer.ts:1548-1551`), and `Schema.toJsonSchemaDocument` emits `{ $ref: "#/$defs/<id>", $defs }` for any schema annotated with an `identifier` — every result schema here is. Without intervention no tool would serve an `outputSchema` (rc.115's own `registerToolkit` has the same blind spot, which is upstream-worthy and recorded as a follow-up). The mirror's `hoistRootRef` lifts a `$ref`-rooted document onto its referenced definition, keeping `$defs` attached for nested refs.

After hoisting, `outputSchema` is served only when the root is `type: "object"`. Four tools' results are discriminated unions (`turbo_inspect`, `changeset_inspect`, `repos_inspect`, `repos_manage`), whose JSON Schema is `anyOf`-rooted, so they serve no `outputSchema`; their `structuredContent` is unaffected. `__test__/server.test.ts` pins "an outputSchema for every struct-rooted result and none for the union-rooted four".

## The error model

`McpToolError` (`src/errors.ts`) is the one typed failure union every tool declares: `WorkspaceNotFound | InvalidArgument | EngineError | BiomeUnavailable | BiomeFailed`, each a `Schema.TaggedError` with `message` and `remediation`. Because of gotcha 3, a structured `remediation` field is invisible to a real client, so every member folds its hint into `message` at construction through `composeRemediatedMessage` (message, hint, then `Try <suggestedTool>.`), and any caller-supplied value echoed back passes through `truncateEchoed` (200 characters). Engine messages — which embed caller values untruncated — route through `ENGINE_ECHO_LIMIT` (2000). `mapEngineError(requestedCwd, remediation)` is the shared mapping: the kit's `WorkspaceRootNotFoundError` → `WorkspaceNotFound`, everything else → `EngineError` with the engine tag as `source`. Every tool uses `failureMode: "error"`, the mode `errors.ts` is written for; the structural test asserts it.

## Testing tiers

- **Structural** (`__test__/toolkit.test.ts`, plain `vitest`): imports `SilkToolkit` with no bin and no platform layer; asserts the ten names, that exactly `biome_check`, `changeset_deps_regen` and `repos_manage` are not read-only, that every tool has a title, description and `SilkMarkdown` renderer, and that every parameters schema compiles to an object-rooted JSON Schema.
- **In-process** (`__test__/server.test.ts`, `@effect/vitest`): the real `ServerLayer(cwd)` over the real `NodeServices.layer` with `Stdio` swapped for `Stdio.layerTest`, driven through `__test__/utils/harness.ts` — a port of Effect's own `McpStdioHarness`. No child process. Covers negotiation (newest, and down to the older listed version), `tools/list` shape, `outputSchema` presence, the dual channel, the failure rendering, and full round trips under the framework's `structuredContent` validation for the struct-rooted tools that a plain tmp fixture can exercise (`changeset_validate` clean and invalid; `biome_check` guarded with `skipIf` on `Lint.Biome.findBiome()`). The "silent on stderr" assertion was deliberately removed from this tier — with no logger layer in the harness it would be vacuous.
- **e2e** (`__test__/e2e/server-lifecycle.e2e.test.ts`, spawning `dist/dev/pkg/bin/savvy-mcp.js` through `__test__/e2e/utils/mcp-process.ts`): initialize → well-formed stdout, stderr exactly `""`, exit 0 on stdin close; `tools/list` returns ten; `tools/call workspace_info` against a tmp fixture returns `structuredContent` and a markdown transcript. The stderr collector is a fiber joined AFTER the exit code, so teardown-time stderr is covered.
- **The pinned gotcha-4 e2e**: "a failing tools/call logs to stderr, never to the stdout wire, and still exits 0" calls `workspace_info { cwd: "/" }`, reads the response BEFORE closing stdin, asserts every stdout line is JSON-RPC, that the result is `isError` with the remediation, that stderr contains `ERROR` and `WorkspaceNotFound` and no `"jsonrpc"`, and exit 0. With the `Logger.LogToStderr` provision deleted from `main.ts` and the bin rebuilt, exactly this case fails (the log line lands on stdout and the reader's `JSON.parse` dies) while the other three stay green — repeated twice for the record.
- **The carrier's view**: `packages/silk/__test__/e2e/bins.e2e.test.ts` and `e2e/silk`'s packed-install test run the same handshake through silk's `savvy-mcp` shim ([package-layering.md](../workspace/package-layering.md#the-carrier-decision)).

Tool handler suites under `__test__/tools/` kept every existing assertion; where a test built the SDK server it now drives the handler directly or decodes against the served Effect schema.

## Rationale

### Why mirror the framework instead of waiting for a hook

The transcript channel is what makes the tools cheaper than Bash for an agent — a markdown summary in `content[0].text` reads in-line, JSON does not. Losing it to adopt the framework's default rendering, or duplicating it into every result schema, both cost more than an 80-line mirror with a written drift baseline and a round-trip test that fails when the mirror stops matching what the framework serves.

### Why the crash guards precede the server import

`main.ts` registers `uncaughtException`/`unhandledRejection` before dynamically importing anything reachable from the tool surface. An import-time failure in the graph (a missing peer, a broken kit build) is then reported through a handler with `savvy-mcp: <label>:` on stderr and exit 1, rather than crashing before any handler exists and leaving a host with no diagnostic.

## Related documentation

- [architecture.md](./architecture.md) — the server as it is now.
- [tools.md](./tools.md) — the per-tool conventions (`Tool.make`, annotations, `SilkMarkdown`).
- [package-layering.md](../workspace/package-layering.md) — the `./main` contract and the carrier that spawns this server.
- [silk/plugin.md](../silk/plugin.md) — the loader that execs the project's own bin.
- [effect-vitest.md](../testing/effect-vitest.md) — suite-wide test conventions.
