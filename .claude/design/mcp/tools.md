---
status: current
module: mcp
category: architecture
created: 2026-09-03
updated: 2026-09-12
last-synced: 2026-09-12
completeness: 90
related:
  - ./architecture.md
  - ./decision-effect-native.md
  - ./changeset-tools.md
  - ./biome-check.md
  - ./repos-tools.md
  - ../silk-effects/architecture.md
  - ../testing/effect-vitest.md
dependencies:
  - ./architecture.md
---

# @savvy-web/mcp tool conventions

The contract every `savvy-mcp` tool follows — Effect Schema as the only schema language, `Tool.make` with declared dependencies, the dual-channel result and the read-only/mutating split — plus the two general-purpose read-only inspection tools, `workspace_info` and `turbo_inspect`.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The tool value](#the-tool-value)
- [Read-only versus mutating](#read-only-versus-mutating)
- [workspace_info](#workspace_info)
- [turbo_inspect](#turbo_inspect)
- [Testing tools](#testing-tools)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

A tool is one file under `src/tools/` exporting a `*Params` schema, a `*Result` schema, a one-way markdown transform, a `*Tool` value built with `Tool.make` and a `handle*` wire handler; `src/toolkit.ts` gathers the ten values into `SilkToolkit` and binds the handlers in `ToolsLayer(cwd)`. Nothing is registered by hand in `server.ts` — the toolkit is. `workspace_info` (`src/tools/workspace-info.ts`) is the reference implementation; every later tool copies its shape. The parent doc, [architecture.md](./architecture.md), covers the server and runtime the handlers run on; [decision-effect-native.md](./decision-effect-native.md) covers why the shape is what it is.

## Current state

Every tool follows three conventions:

- **Effect Schema is the only schema language.** Parameters, the result and the shared `McpToolError` failure union are Effect `Schema`, with `.annotate()` carrying identifiers and descriptions; the framework derives the wire JSON Schema from them. The handler is an Effect that yields silk-effects services and resolves the workspace root via `WorkspaceRoot.find` from the requested (or startup-fallback) `cwd` before it does anything else, with its error channel mapped onto `McpToolError` through `mapEngineError`. All logic stays in silk-effects; the tool file is glue.
- **Dual-channel return.** The structured result is rendered to a markdown transcript via a one-way `Schema.decodeTo` transform (decode succeeds to markdown, encode is forbidden), attached to the tool as a `SilkMarkdown` annotation. The server's registration puts that transcript in `content[0].text` and the encoded result in `structuredContent`; the result schema itself carries no markdown field.
- **Every result shape that crosses to an agent is a silk-effects `Schema.Struct`** (or a union of them) embedded unchanged, so the wire tracks the service without a second projection layer — with the one deliberate exception in [workspace_info](#workspace_info).

Strings interpolated from repo content into a transcript are rendered as inert code spans, because file names, package names and vendored-repo metadata are untrusted input that could otherwise inject markdown structure into what the agent reads. The repos tools share `src/tools/md-inline.ts` for this; see that file's header for the delimiter-run rule it uses.

## The tool value

```ts
export const workspaceInfoTool = Tool.make("workspace_info", {
  description, // states "markdown in content[] and a typed object in structuredContent"
  parameters: WorkspaceInfoParams,
  success: WorkspaceInfoResult,
  failure: McpToolError,
  dependencies: [SilkWorkspaceAnalyzer, WorkspaceRoot],
})
  .annotate(Tool.Title, "Workspace info")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false)
  .annotate(SilkMarkdown, Schema.decodeUnknownSync(WorkspaceInfoAsMarkdown));
```

Three details are load-bearing. `dependencies` MUST name every service the handler yields — without it `Tool.HandlerServices` infers `never` and the handler record fails to typecheck against the toolkit (gotcha 1 in the decision record); `biome_check` yields none and declares none. `failure: McpToolError` is the one union every tool declares, and because a declared failure reaches the wire as `message` text only, each member composes its remediation into `message` at construction (see [decision-effect-native.md](./decision-effect-native.md#the-error-model)). `SilkMarkdown` is what the server reads to fill the text channel; a tool without it would fall back to the framework's JSON text. `Tool.Title` is lifted by the framework to the top-level `title`. `outputSchema` is served only when the result's JSON Schema is object-rooted after hoisting the `$ref` root; the four union-rooted results (`turbo_inspect`, `changeset_inspect`, `repos_inspect`, `repos_manage`) serve none.

`__test__/toolkit.test.ts` is the structural gate: it imports `SilkToolkit` with no bin and no platform layer and asserts the ten names, the read-only split, that every tool has a title, description and renderer, that every tool uses `failureMode: "error"`, and that every parameters schema compiles to an object-rooted JSON Schema with described properties.

## Read-only versus mutating

Read-only is the convention. Every tool carries all four MCP hints through `Tool.Readonly`/`Tool.Destructive`/`Tool.Idempotent`/`Tool.OpenWorld`. `workspace_info`, `turbo_inspect`, `changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_detect` and `repos_inspect` are `Readonly: true`, `Idempotent: true` and never touch the working tree. Three tools are the documented exceptions, each `Readonly: false`, `Idempotent: false`:

- `changeset_deps_regen` and `repos_manage` are additionally `Destructive: true`. Both run as ordinary Effect handlers over the runtime layer like the rest.
- `biome_check` is `Destructive: false`, edits files only when `write`/`unsafe` is set, and is the only tool whose handler does not yield a silk-effects service — it shells Biome directly, lifted into Effect with `Effect.tryPromise`.

The three form a hierarchy of surface: `biome_check` touches source files (deterministic, git-reversible), `changeset_deps_regen` is confined to `.changeset/*.md` (git-reversible) and `repos_manage` reaches git infrastructure, local git config and filesystem permissions. `biome_check` and `changeset_deps_regen` default to non-mutating call paths (a bare call only reads or only plans); `repos_manage` always mutates. Each is detailed in its own doc: [changeset-tools.md](./changeset-tools.md), [biome-check.md](./biome-check.md) and [repos-tools.md](./repos-tools.md).

## workspace_info

`workspace_info` (`src/tools/workspace-info.ts`) wraps `SilkWorkspaceAnalyzer`. Its output is a deliberately **flat, non-recursive projection** of `WorkspaceAnalysis`: `linked`/`fixed` collapse to arrays of workspace names and `targets` to registry URL strings. This keeps the recursive `Schema.suspend` in `AnalyzedWorkspace` off the wire schema (see [Rationale](#why-a-flat-tool-projection-over-the-rich-analysis)) and is more token-efficient for the agent.

## turbo_inspect

`turbo_inspect` (`src/tools/turbo-inspect.ts`) wraps silk-effects' `Turbo.TurboInspector` — read-only Turborepo introspection that never executes a task (every path is `turbo … --dry=json`). Its result is a **discriminated union keyed by `mode`** (`cache` | `graph` | `affected`), each variant embedding the corresponding flat `Turbo` result schema unchanged; being union-rooted it serves no `outputSchema`, but `structuredContent` is the typed variant. The `TurboInspector` finds the `turbo` binary through the runtime's single `ToolDiscovery` instance, so its probe cache is shared for the server's lifetime. The silk plugin's `turbo` skill and `turborepo` agent sit on top of this tool; see [plugin.md](../silk/plugin.md).

## Testing tools

Tool tests live under `__test__/tools/`. A test that stands in for the filesystem builds an `@effected/memfs` volume seeded at the exact paths the tool should read, and reaches for `MemoryFileSystem.layerFaulty` over a volume where the file genuinely exists when a permission failure is the subject — otherwise "denied" and "missing" produce the same fixture and the two tests stop being distinguishable. `__test__/tools/repos-inspect.test.ts` is the worked example; the rules are suite-wide, in [effect-vitest.md](../testing/effect-vitest.md#filesystem-doubles-effectedmemfs). Above the handler suites sit the structural `toolkit.test.ts`, the in-process `server.test.ts` round trips over `Stdio.layerTest` and the `dist`-spawning lifecycle e2e — the tiers are laid out in [decision-effect-native.md](./decision-effect-native.md#testing-tiers). `__test__/tarball.test.ts` checks the packed artifact, including that `./main` ships.

## Rationale

### Why a flat tool projection over the rich analysis

`WorkspaceAnalysis` uses recursive `Schema.suspend` for `linked`/`fixed` cross-references. The projection predates the Effect-native server (the old zod bridge could not inline recursive refs) and stays: a flat, name-only result keeps the served JSON Schema simple and produces more token-efficient output for the consuming agent. The projection is the tool's contract; the rich analysis stays the analyzer's contract in silk-effects.

### Why discriminated unions keyed by `mode`

An agent's workflow is "know the available inspections, pick one". One tool per subsystem with a `mode` discriminant keeps the discovery burden low and lets each variant embed the silk-effects result schema unchanged, so the wire shape tracks the service without a second projection layer. The same reasoning drives `repos_manage`'s single `action`-discriminated surface (see [repos-tools.md](./repos-tools.md#rationale)).

## Related documentation

- [architecture.md](./architecture.md) — the server and runtime these tools run on.
- [decision-effect-native.md](./decision-effect-native.md) — the registration mirror, error model, gotchas and test tiers.
- [changeset-tools.md](./changeset-tools.md), [biome-check.md](./biome-check.md), [repos-tools.md](./repos-tools.md) — the remaining tools.
- [silk-effects/architecture.md](../silk-effects/architecture.md) — `SilkWorkspaceAnalyzer` and the `Turbo` namespace.
