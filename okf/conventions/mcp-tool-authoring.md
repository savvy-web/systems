---
type: Convention
title: Shape and test a savvy-mcp tool
description: "Define a tool's parameters, result and failure union as Effect Schema only, declare every yielded service in Tool.make's dependencies array, annotate all four MCP hints (Readonly, Destructive, Idempotent, OpenWorld), attach a markdown renderer via the SilkMarkdown annotation, and default a tool to read-only unless it is one of the three documented mutating exceptions."
tags: [tooling, testing]
stale_after: 2026-12-11T00:00:00Z
sources:
  - id: mcp-tools
    resource: ../../packages/mcp/src/toolkit.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: e479cab48393aac012bb6b0e6d1b5f5e59415fe02398c34e238ba13038f8c416
---

# Shape and test a savvy-mcp tool

Write one file per tool under `src/tools/`, exporting a `*Params` schema, a `*Result` schema, a one-way markdown transform, a `*Tool` value built with `Tool.make`, and a `handle*` wire handler. Use `workspace_info` (`src/tools/workspace-info.ts`) as the reference shape for a new tool — every other tool copies it. Register a new tool by adding it to `src/toolkit.ts`'s `SilkToolkit` gathering and `ToolsLayer(cwd)`'s handler binding; never register a tool by hand in `server.ts`.[^mcp-tools]

Use Effect Schema as the only schema language for a tool's parameters, its result and the shared `McpToolError` failure union — never zod, never a hand-written JSON Schema. Annotate every schema with `.annotate()` to carry identifiers and descriptions, since the framework derives the served JSON Schema from them. Embed a silk-effects `Schema.Struct` (or a union of them) unchanged as the result shape wherever possible, rather than defining a second MCP-only projection layer — `workspace_info`'s flat, non-recursive projection is the one deliberate exception, chosen to keep a recursive `Schema.suspend` off the wire and to keep output token-efficient.[^mcp-tools]

Declare every service a tool's handler yields in `Tool.make`'s `dependencies` array. Omitting one is not a style nit: `Tool.HandlerServices` infers `never` without it, and the handler record fails to typecheck against the toolkit. Have the handler resolve the workspace root via `WorkspaceRoot.find` from the requested (or startup-fallback) `cwd` before doing anything else, and map its error channel onto `McpToolError` through `mapEngineError`. Keep all business logic in silk-effects — the tool file is glue, not a second place logic lives.[^mcp-tools]

Compose a tool's remediation hint into its failure's `message` at construction, never into a separate structured field — a declared typed failure reaches the wire as `message` text only, so a `remediation` field on the schema would be invisible to a real client. Declare `failure: McpToolError` as the one failure union every tool uses, and set `failureMode: "error"`.[^mcp-tools]

Attach a tool's markdown transcript via the `SilkMarkdown` annotation (a one-way `Schema.decodeTo` transform whose encode direction is forbidden) rather than adding a markdown field to the result schema — a tool without this annotation falls back to the framework's raw JSON text channel instead of a readable transcript. Render any string interpolated from repo content (a file name, a package name, vendored-repo metadata) as an inert code span before it reaches a transcript, since that content is untrusted input that could otherwise inject markdown structure into what the agent reads; reuse `src/tools/md-inline.ts` for this rather than re-deriving the delimiter-run rule.[^mcp-tools]

Annotate every tool with all four MCP hints — `Tool.Readonly`, `Tool.Destructive`, `Tool.Idempotent`, `Tool.OpenWorld` — and default a new tool to `Readonly: true`, `Idempotent: true` unless it is one of the three documented mutating exceptions (`biome_check`, `changeset_deps_regen`, `repos_manage`), each of which is `Readonly: false`, `Idempotent: false` and justifies its own mutation surface in its own doc. Default a mutating tool's bare call to a non-destructive path (read-only or plan-only) rather than mutating unconditionally, unless the tool's whole purpose is mutation (`repos_manage`).[^mcp-tools]

Test a tool under `__test__/tools/`. When a test stands in for the filesystem, build an `@effected/memfs` volume seeded at the exact paths the tool should read, and reach for `MemoryFileSystem.layerFaulty` — never a volume where the file genuinely exists — when the behavior under test is a permission failure, so "denied" and "missing" stay distinguishable fixtures rather than collapsing to the same one. Keep the structural gate (`__test__/toolkit.test.ts`, importing `SilkToolkit` with no bin and no platform layer) green: it asserts every tool has a title, a description, a renderer, `failureMode: "error"`, and an object-rooted parameters schema with described properties. See [effect-native-mcp-server](../decisions/effect-native-mcp-server.md#context) for the three testing tiers above the per-tool suite (structural, in-process, e2e) that this per-tool convention sits beneath.

See [mcp](../modules/mcp.md) for the module this convention governs and [savvy-mcp-tools](../interfaces/savvy-mcp-tools.md) for the ten tools' contracts from the consumer's side.

[^mcp-tools]: `../../packages/mcp/src/toolkit.ts`
