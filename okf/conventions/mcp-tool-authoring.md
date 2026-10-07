---
type: Convention
status: draft
title: Shape and test a savvy-mcp tool
description: "Define a tool's parameters, result and failure union as Effect Schema only, declare every yielded service in the tool's dependencies array, serve action-keyed parameters through McpToolkit.unionTool and union results through ToolOutputSchema.objectRooted, refuse with ToolRefusal.refuse, annotate all four MCP hints (Readonly, Destructive, Idempotent, OpenWorld), add no text projection since the result schema is the whole contract, and default a tool to read-only unless it is one of the three documented mutating exceptions."
tags: [tooling, testing]
stale_after: 2026-12-11T00:00:00Z
sources:
  - id: mcp-tools
    resource: ../../packages/mcp/src/toolkit.ts
  - id: mcp-server
    resource: ../../packages/mcp/src/server.ts
  - id: mcp-errors
    resource: ../../packages/mcp/src/errors.ts
  - id: mcp-repos-manage
    resource: ../../packages/mcp/src/tools/repos-manage.ts
generated:
  by: okfit/claude-code
  at: 2026-09-26T22:54:36Z
  body_sha256: a285143b168714e7ca475942847adc40fc8d6e9bd0cc9ba0a72bbaa1cff2885c
---

# Shape and test a savvy-mcp tool

Write one file per tool under `src/tools/`, exporting a `*Params` schema, a `*Result` schema, a `*Tool` value built with `Tool.make` (or `McpToolkit.unionTool`, below), and a `handle*` wire handler. Use `workspace_info` (`src/tools/workspace-info.ts`) as the reference shape for a new tool — every other tool copies it. Register a new tool by adding it to `src/toolkit.ts`'s `SilkToolkit` gathering and `ToolsLayer(cwd)`'s handler binding; never register a tool by hand in `server.ts`.[^mcp-tools]

Use Effect Schema as the only schema language for a tool's parameters, its result and the shared `McpToolError` failure union — never zod, never a hand-written JSON Schema. Annotate every schema with `.annotate()` to carry identifiers and descriptions, since the framework derives the served JSON Schema from them. Embed a silk-effects `Schema.Struct` (or a union of them) unchanged as the result shape wherever possible — and wrap a union result in `@effected/mcp`'s `ToolOutputSchema.objectRooted`, since core serves `outputSchema` only for an object-rooted schema and a bare union would ship none; every existing tool serves one — rather than defining a second MCP-only projection layer — `workspace_info`'s flat, non-recursive projection is the one deliberate exception, chosen to keep a recursive `Schema.suspend` off the wire and to keep output token-efficient.[^mcp-tools]

When a tool's parameters depend on an action or mode — different required fields per value — declare them as a `Schema.Union` of one `Schema.Struct` per action, each with an `action: Schema.Literal(...)` key, and build the tool with `McpToolkit.unionTool` and its handler with `McpToolkit.unionHandler`, as `repos_manage` does. Never flatten such parameters into one struct of optional fields and re-decode them in the handler: the union tool serves a strict `oneOf` keyed by the discriminator, so a client sees each action's required fields and a missing field or a stray key is rejected as invalid parameters, naming it, before the handler runs. Keep one member per discriminator value; express a finer per-value requirement (such as `note`'s per-`op` fields) as a `.check` filter on that member rather than as a second member sharing the same `action`.[^mcp-repos-manage]

Declare every service a tool's handler yields in `Tool.make`'s `dependencies` array. Omitting one is not a style nit: `Tool.HandlerServices` infers `never` without it, and the handler record fails to typecheck against the toolkit. Have the handler resolve the workspace root via `WorkspaceRoot.find` from the requested (or startup-fallback) `cwd` before doing anything else, and map its error channel onto `McpToolError` through `mapEngineError`. Keep all business logic in silk-effects — the tool file is glue, not a second place logic lives.[^mcp-tools]

Compose a tool's remediation hint into its failure's `message` at construction, never into a separate structured field — a declared typed failure reaches the wire as `message` text only, so a `remediation` field on the schema would be invisible to a real client. Refuse a call that carries nothing beyond its message — a bad argument, a path outside the workspace, a missing binary — with the kit's `ToolRefusal.refuse(reason, remediation)`, already a member of `McpToolError`; do not add a local error class for it. Add a new `McpToolError` member only for a failure that carries a field of its own (as `WorkspaceNotFound` carries `cwd`, `EngineError` `source`, `BiomeFailed` `exitCode`), and build it on `@effected/mcp`'s `ToolFailure`: spread `ToolFailure.fields`, compose the message with `ToolFailure.message`, and pass any caller-supplied value it echoes through `ToolFailure.truncate`.[^mcp-errors] Declare `failure: McpToolError` as the one failure union every tool uses, and set `failureMode: "error"`.[^mcp-tools]

Write no text projection for a tool — no markdown renderer, no per-tool annotation over `content`, no `markdown` field on the result. The result schema IS the contract: `McpToolkit` serves the encoded result as `structuredContent` and the same object as JSON in `content[0].text`, and Claude Code hands the model only `structuredContent`.[^mcp-server] Put everything a caller needs into the result schema's fields and their `.annotate()` descriptions instead. End the tool's `description` by saying the result is a typed object in `structuredContent` with the same object as JSON in `content[]`, as every existing tool does, so an agent reads fields rather than parsing text.[^mcp-tools] Register a new tool through `SilkToolkit` only, and leave a `Tool.make` tool unannotated by `Tool.Strict` unless it has a reason to reject extra arguments, since the served registration keeps unannotated tools lenient; a `unionTool` is always strict.[^mcp-server]

Annotate every tool with all four MCP hints — `Tool.Readonly`, `Tool.Destructive`, `Tool.Idempotent`, `Tool.OpenWorld` — and default a new tool to `Readonly: true`, `Idempotent: true` unless it is one of the three documented mutating exceptions (`biome_check`, `changeset_deps_regen`, `repos_manage`), each of which is `Readonly: false`, `Idempotent: false` and justifies its own mutation surface in its own doc. Default a mutating tool's bare call to a non-destructive path (read-only or plan-only) rather than mutating unconditionally, unless the tool's whole purpose is mutation (`repos_manage`).[^mcp-tools]

Test a tool under `__test__/tools/`. When a test stands in for the filesystem, build an `@effected/memfs` volume seeded at the exact paths the tool should read, and reach for `MemoryFileSystem.layerFaulty` — never a volume where the file genuinely exists — when the behavior under test is a permission failure, so "denied" and "missing" stay distinguishable fixtures rather than collapsing to the same one. Keep the structural gate (`__test__/toolkit.test.ts`, importing `SilkToolkit` with no bin and no platform layer) green: it asserts every tool has a title, a description, the four MCP hints, `failureMode: "error"`, and an object-rooted parameters schema with described properties. See [effect-native-mcp-server](../decisions/effect-native-mcp-server.md#context) for the three testing tiers above the per-tool suite (structural, in-process, e2e) that this per-tool convention sits beneath.

See [mcp](../modules/mcp.md) for the module this convention governs and [savvy-mcp-tools](../interfaces/savvy-mcp-tools.md) for the ten tools' contracts from the consumer's side.

[^mcp-tools]: `../../packages/mcp/src/toolkit.ts`
[^mcp-server]: `../../packages/mcp/src/server.ts`
[^mcp-errors]: `../../packages/mcp/src/errors.ts`
[^mcp-repos-manage]: `../../packages/mcp/src/tools/repos-manage.ts`
