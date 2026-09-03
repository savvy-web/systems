---
status: current
module: mcp
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ./changeset-tools.md
  - ./biome-check.md
  - ./repos-tools.md
  - ../silk-effects/architecture.md
  - ../testing/effect-vitest.md
dependencies:
  - ./architecture.md
---

# @savvy-web/mcp tool conventions

The contract every `savvy-mcp` tool follows — schema canon, the dual-channel result, the Effect→zod bridge and the read-only/mutating split — plus the two general-purpose read-only inspection tools, `workspace_info` and `turbo_inspect`.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The Effect to zod bridge](#the-effect-to-zod-bridge)
- [Read-only versus mutating](#read-only-versus-mutating)
- [workspace_info](#workspace_info)
- [turbo_inspect](#turbo_inspect)
- [Testing tools](#testing-tools)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

A tool is one file under `src/tools/` exporting a result schema, a one-way markdown transform and a handler, plus one `server.registerTool` call in `src/server.ts` that supplies the wire description, the zod input schema and the annotations. `workspace_info` (`src/tools/workspace-info.ts`) is the reference implementation; every later tool copies its shape. The parent doc, [architecture.md](./architecture.md), covers the runtime the handlers run on.

## Current state

Every tool follows three conventions:

- **Effect Schema is the source of truth** for the result, with `.annotate()` carrying identifiers and descriptions. The handler runs as `ctx.runtime.runPromise(Effect.gen(...))`, yielding silk-effects services and resolving the workspace root via `WorkspaceRoot.find` from the requested (or fallback) `cwd` before it does anything else. All logic stays in silk-effects; the tool file is glue.
- **Dual-channel return.** The structured result is rendered to a markdown transcript via a one-way `Schema.decodeTo` transform (decode succeeds to markdown, encode is forbidden), and the registration returns `{ content: [{ type: "text", text }], structuredContent }`.
- **Effect Schema bridges to zod at the SDK boundary.** `@modelcontextprotocol/sdk`'s `registerTool` accepts only zod, so `outputSchema` is `effectToZodSchema(Result)`; input schemas are written directly in zod since they are wire-only.

Strings interpolated from repo content into a transcript are rendered as inert code spans, because file names, package names and vendored-repo metadata are untrusted input that could otherwise inject markdown structure into what the agent reads. The repos tools share `src/tools/md-inline.ts` for this; see that file's header for the delimiter-run rule it uses.

## The Effect to zod bridge

`src/schema/effect-to-zod.ts` routes Effect Schema → `Schema.toJsonSchemaDocument` → inlined `$ref`s → `z.fromJSONSchema`. This is the one place the canonical Effect Schema crosses into the SDK's world, and it is where Effect v4's JSON Schema encoding deltas (non-finite number arms, the `null` arm `Schema.optional` adds, filter checks emitted as `allOf`) are normalized back to the wire contract — in the bridge, never in the public schemas. The file's `@remarks` list the constraints: no `Schema.suspend` (recursive refs make inlining non-terminating), Effect-only refinements erase and a non-object root is wrapped so the SDK accepts it. `effectSchemaToInlinedJsonSchema` is exported separately so `__test__/schema/` can snapshot exactly what the bridge feeds zod.

## Read-only versus mutating

Read-only is the convention. `turbo_inspect`, `changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_detect` and `repos_inspect` register with `annotations: { readOnlyHint: true }` and never touch the working tree; `workspace_info` is likewise read-only but currently registers no annotations. Three tools are the documented exceptions:

- `changeset_deps_regen` and `repos_manage` register `{ destructiveHint: true, idempotentHint: false }`. Both run on the Effect runtime like the rest.
- `biome_check` registers no annotations, edits files only when `write`/`unsafe` is set and is the only tool that bypasses the Effect runtime to shell a CLI directly.

The three form a hierarchy of surface: `biome_check` touches source files (deterministic, git-reversible), `changeset_deps_regen` is confined to `.changeset/*.md` (git-reversible) and `repos_manage` reaches git infrastructure, local git config and filesystem permissions. `biome_check` and `changeset_deps_regen` default to non-mutating call paths (a bare call only reads or only plans); `repos_manage` always mutates. Each is detailed in its own doc: [changeset-tools.md](./changeset-tools.md), [biome-check.md](./biome-check.md) and [repos-tools.md](./repos-tools.md).

## workspace_info

`workspace_info` (`src/tools/workspace-info.ts`) wraps `SilkWorkspaceAnalyzer`. Its output is a deliberately **flat, non-recursive projection** of `WorkspaceAnalysis`: `linked`/`fixed` collapse to arrays of workspace names and `targets` to registry URL strings. This avoids the recursive `Schema.suspend` in `AnalyzedWorkspace`, which the bridge cannot inline (see [Rationale](#why-a-flat-tool-projection-over-the-rich-analysis)), and is more token-efficient for the agent.

## turbo_inspect

`turbo_inspect` (`src/tools/turbo-inspect.ts`) wraps silk-effects' `Turbo.TurboInspector` — read-only Turborepo introspection that never executes a task (every path is `turbo … --dry=json`). Its result is a **discriminated union keyed by `mode`** (`cache` | `graph` | `affected`), each variant embedding the corresponding flat `Turbo` result schema so the union round-trips through the bridge. The `TurboInspector` finds the `turbo` binary through the runtime's single `ToolDiscovery` instance, so its probe cache is shared for the server's lifetime. The silk plugin's `turbo` skill and `turborepo` agent sit on top of this tool; see [plugin.md](../silk/plugin.md).

## Testing tools

Tool tests live under `__test__/tools/`. A test that stands in for the filesystem builds an `@effected/memfs` volume seeded at the exact paths the tool should read, and reaches for `MemoryFileSystem.layerFaulty` over a volume where the file genuinely exists when a permission failure is the subject — otherwise "denied" and "missing" produce the same fixture and the two tests stop being distinguishable. `__test__/tools/repos-inspect.test.ts` is the worked example; the rules are suite-wide, in [effect-vitest.md](../testing/effect-vitest.md#filesystem-doubles-effectedmemfs). `__test__/server.build.test.ts` exercises the registrations themselves, and `__test__/tarball.test.ts` checks the packed artifact.

## Rationale

### Why a flat tool projection over the rich analysis

`WorkspaceAnalysis` uses recursive `Schema.suspend` for `linked`/`fixed` cross-references, which the Effect Schema → JSON Schema → zod bridge cannot inline. Projecting to a flat, name-only result both satisfies the bridge and produces more token-efficient output for the consuming agent. The projection is the tool's contract; the rich analysis stays the analyzer's contract in silk-effects.

### Why discriminated unions keyed by `mode`

An agent's workflow is "know the available inspections, pick one". One tool per subsystem with a `mode` discriminant keeps the discovery burden low and lets each variant embed the silk-effects result schema unchanged, so the wire shape tracks the service without a second projection layer. The same reasoning drives `repos_manage`'s single `action`-discriminated surface (see [repos-tools.md](./repos-tools.md#rationale)).

## Related documentation

- [architecture.md](./architecture.md) — the server and runtime these tools run on.
- [changeset-tools.md](./changeset-tools.md), [biome-check.md](./biome-check.md), [repos-tools.md](./repos-tools.md) — the remaining tools.
- [silk-effects/architecture.md](../silk-effects/architecture.md) — `SilkWorkspaceAnalyzer` and the `Turbo` namespace.
