---
status: current
module: templates
category: architecture
created: 2026-03-31
updated: 2026-06-12
last-synced: 2026-06-12
completeness: 90
related:
  - ../cli/architecture.md
  - ../silk-effects/architecture.md
dependencies: []
---

# @savvy-web/templates architecture

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Module architecture](#module-architecture)
- [Core types](#core-types)
- [Template pattern](#template-pattern)
- [Template inventory](#template-inventory)
- [Dependencies](#dependencies)
- [Consumer guide](#consumer-guide)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`@savvy-web/templates` is a pure TypeScript library for generating project configuration content from typed options. It replaces the defunct Yeoman-based generators with stateless functions that take options and return generated file content.

The library produces `TemplateEntry[]` arrays describing file content. It performs no I/O, no file writing, no prompting and no path resolution. Consumers decide what to do with the output. Effect Schema validates options at the boundary; invalid input throws `ParseError`.

The package lives at `packages/templates` in `savvy-web/systems` and runs in any JavaScript runtime with no platform dependencies.

## Current State

All templates are implemented and published. The public API is a single root export (`"."`): consumers import everything from `@savvy-web/templates`. See `src/index.ts` for the full export surface.

## Module architecture

Each template is a single-file module under `src/lib/<name>/index.ts`, with the shared types in `src/lib/types.ts` and the workspace compositor in `src/lib/workspace/index.ts`. Tests live in a dedicated `__test__/` directory, one file per template plus an integration test under `__test__/integration/`.

Each template module exports three things:

1. A `Schema` — an Effect Schema struct for the options type
2. An `OptionsType` — a TypeScript type alias (`typeof Schema.Type`)
3. A `create*(options: unknown)` function — validates and returns `TemplateEntry[]`

## Core types

The three cardinal types are defined in `src/lib/types.ts` and are load-bearing across every template:

```typescript
interface TemplateEntry {
  readonly name: string;      // logical name (e.g. "tsconfig", "biome")
  readonly filename: string;  // suggested filename (e.g. "tsconfig.json")
  readonly content: string;   // generated file content
}

type Template<O> = (options: O) => TemplateEntry[];

type UpdateTemplate<O> = (existing: string, options: Partial<O>) => TemplateEntry[];
```

`TemplateEntry.filename` is a sensible default. Directory structure in filenames (e.g. `.vscode/settings.json`, `.changeset/config.json`) is part of the suggested path, not an assertion about filesystem layout. Consumers may use it directly or map entries to their own paths.

`UpdateTemplate<O>` is defined for future config-update work. No template currently exports an update function.

## Template pattern

Every template follows the same shape: define an options schema, export its type alias, then export a `create*` function that validates `unknown` input and returns content entries.

```typescript
export const FooOptions = Schema.Struct({
  required: Schema.String,
  optional: Schema.optional(Schema.Boolean),
});

export type FooOptionsType = typeof FooOptions.Type;

export function createFoo(options: unknown): TemplateEntry[] {
  const opts = Schema.decodeUnknownSync(FooOptions)(options);
  const content = JSON.stringify(config, null, "\t");
  return [{ name: "foo", filename: "foo.json", content }];
}
```

Key properties:

- **Input is `unknown`:** Schema validation happens at the boundary. Callers pass untyped data; the function validates or throws `ParseError`.
- **Output is `TemplateEntry[]`:** most templates return a single entry, `vscode` returns two and `workspace` returns many composed from sub-templates.
- **Pure functions:** no I/O, no side effects, no mutable state.
- **JSON uses tabs:** all JSON output uses `JSON.stringify(obj, null, "\t")` to match the Silk Suite style.

## Template inventory

There are ten template modules. For each, the options schema in the module's `index.ts` is authoritative about its fields; this section records only what each produces and the constraints that are not obvious from the schema.

- **package-json** (`createPackageJson`) — emits `package.json`. Uses `sort-package-json` for field ordering and omits empty or undefined fields.
- **tsconfig** (`createTsConfig`) — emits `tsconfig.json`. `extends` is always normalized to an array. Minimal output; most config lives in the extended base.
- **biome** (`createBiome`) — emits `biome.jsonc`. The required `version` drives the `$schema` URL.
- **turbo** (`createTurboRoot`, `createTurboWorkspace`) — two functions because root and workspace `turbo.json` have different schemas. The workspace form emits `extends: ["//"]`.
- **pnpm** (`createPnpmWorkspace`) — emits `pnpm-workspace.yaml`. Uses `js-yaml` for serialization.
- **gitignore** (`createGitignore`) — emits `.gitignore` from categorized sections via plain string concatenation, no template engine.
- **changeset** (`createChangeset`) — emits `.changeset/config.json` with Silk Suite defaults.
- **vscode** (`createVsCode`) — emits two entries, `.vscode/settings.json` and `.vscode/extensions.json`, with conditional Biome/Turbo/Vitest settings.
- **readme** (`createReadme`) — emits a minimal `README.md` (h1 plus description); README content is project-specific.
- **workspace** (`createWorkspace`) — the master compositor. See below.

### Workspace compositor

`createWorkspace` orchestrates the other templates, calling their `create*` functions directly with derived options. It always emits package-json, tsconfig, gitignore and readme; it conditionally adds pnpm (when `packageManager === "pnpm"`) plus biome, turbo, changeset and vscode based on the `features` flags. See `src/lib/workspace/index.ts` for the exact composition and the derived options it threads into each sub-template.

## Dependencies

Runtime dependencies are `sort-package-json` (package.json field ordering) and `js-yaml` (YAML serialization). `effect` is a peer dependency, used only for Schema validation at the boundary.

This package has no platform dependencies. Unlike `@savvy-web/silk-effects` it does not depend on `@effect/platform`, `workspaces-effect` or any other Effect service package. Those require Layer composition, which is overkill for pure content generation — templates serialize in-memory objects with `JSON.stringify`, `js-yaml` and string construction directly.

The package builds with `@savvy-web/bundler`. See `package.json` and `savvy.build.ts` for the build wiring and the dual-registry `publishConfig.targets`.

## Consumer guide

Install the package alongside its `effect` peer and import everything from the root:

```typescript
import { createBiome, createWorkspace } from "@savvy-web/templates";
```

Generate a single config:

```typescript
const entries = createBiome({ version: "2.3.3", root: true });
// => [{ name: "biome", filename: "biome.jsonc", content: "..." }]
```

Scaffold a whole workspace with `createWorkspace`, then write the returned entries to disk yourself — placement is the consumer's responsibility:

```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

for (const entry of entries) {
  const filepath = join(targetDir, entry.filename);
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, entry.content);
}
```

Invalid options throw `ParseError` from Effect Schema. There are no custom error types.

## Rationale

### Why pure functions instead of Effect services?

Templates generate content. They do not read files, write files, resolve paths or interact with the platform. Effect services add Layer composition overhead that provides no benefit when the entire operation is `options => string`. Keeping templates as pure functions makes them trivially testable, composable and usable in any context without Effect runtime setup.

### Why no template engine?

Template engines add complexity (partials, helpers, escaping) without benefit for structured output. JSON configs are best built programmatically with `JSON.stringify`, YAML uses `js-yaml` and gitignore and README are simple string concatenation. TypeScript provides all the control flow needed with type safety a template engine cannot offer.

### Why a single entry point?

Consumers should not need to know internal module structure. A single root export with tree-shaking (`sideEffects: false`) gives the simplest consumer experience while letting bundlers eliminate unused templates.

### Why `unknown` input instead of typed options?

Each `create*` function accepts `unknown` and validates with `Schema.decodeUnknownSync`. This makes templates usable from untyped sources (CLI arguments, JSON config files, user prompts) without requiring callers to pre-validate. TypeScript users still get type inference from the exported `Schema` and `OptionsType` types.

### Why separate create functions instead of a single dispatcher?

Individual functions give per-template autocomplete, tree-shaking of unused templates and clear greppable call sites, with no string-based dispatch or registry lookup.

### Why `TemplateEntry` instead of writing directly?

Separating content generation from I/O enables testing without filesystem mocking, preview and dry-run modes, custom path mapping, and batching or conflict resolution in the caller — usable from both CLI tools and programmatic APIs.

## Related documentation

- [`../cli/architecture.md`](../cli/architecture.md) — the `savvy` CLI, a downstream consumer of generated content.
- [`../silk-effects/architecture.md`](../silk-effects/architecture.md) — the shared Effect library whose pure-function and single-root-export conventions templates mirror.
