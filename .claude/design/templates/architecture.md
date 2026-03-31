---
name: templates-architecture
title: "@savvy-web/templates Architecture"
module: templates
category: architecture
status: current
completeness: 90
last-synced: 2026-03-31
depends-on: []
---

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Module Architecture](#module-architecture)
- [Core Types](#core-types)
- [Template Pattern](#template-pattern)
- [Template Inventory](#template-inventory)
- [Dependencies](#dependencies)
- [Consumer Guide](#consumer-guide)
- [Rationale](#rationale)

## Overview

`@savvy-web/templates` is a pure TypeScript library for generating project configuration
content from typed options. It replaces the defunct `@savvy-web/generators` (Yeoman-based)
with stateless functions that take options and return generated file content.

The library produces `TemplateEntry[]` arrays describing file content. It performs no I/O,
no file writing, no prompting, and no path resolution. Consumers decide what to do with the
output. Effect Schema validates options at the boundary; invalid input throws `ParseError`.

**Package:** `@savvy-web/templates`
**Location:** `packages/templates` in `savvy-web/systems`
**Runtime:** Any JavaScript runtime (no platform dependencies)
**Issue:** savvy-web/systems#9 (parent epic: savvy-web/systems#8)

## Current State

v0.1.0 on `feat/templates` branch -- all 10 templates implemented with tests:

| Area | Files | Tests |
| ---- | ----- | ----- |
| Core types | `lib/types.ts` | `__test__/types.test.ts` |
| Templates | `lib/{name}/index.ts` (10 modules) | `__test__/{name}.test.ts` (10 files) |
| Compositor | `lib/workspace/index.ts` | `__test__/workspace.test.ts` |
| Integration | -- | `__test__/integration/templates.int.test.ts` |

Total: 12 test files across the `__test__/` directory.

**Single root export:** All public API is exported from the package root (`"."`). Consumers
import everything from `@savvy-web/templates`.

## Module Architecture

### Source Layout

```text
src/
  index.ts              <- single barrel export
  lib/
    types.ts            <- TemplateEntry, Template<O>, UpdateTemplate<O>
    biome/index.ts
    changeset/index.ts
    gitignore/index.ts
    package-json/index.ts
    pnpm/index.ts
    readme/index.ts
    tsconfig/index.ts
    turbo/index.ts
    vscode/index.ts
    workspace/index.ts  <- master compositor
```

Tests live in a dedicated `__test__/` directory (one file per template, plus an integration
test). Each template module is a single file exporting:

1. A `Schema` -- Effect Schema struct for the options type
2. An `OptionsType` -- TypeScript type alias (`typeof Schema.Type`)
3. A `create*(options: unknown)` function -- validates and returns `TemplateEntry[]`

## Core Types

```typescript
interface TemplateEntry {
  readonly name: string;      // logical name (e.g., "tsconfig", "biome")
  readonly filename: string;  // suggested filename (e.g., "tsconfig.json")
  readonly content: string;   // generated file content
}

type Template<O> = (options: O) => TemplateEntry[];

type UpdateTemplate<O> = (existing: string, options: Partial<O>) => TemplateEntry[];
```

`TemplateEntry.filename` is a sensible default. Directory structure in filenames
(e.g., `.vscode/settings.json`, `.changeset/config.json`) is part of the suggested path,
not an assertion about filesystem layout. Consumers may use it directly or map entries to
their own paths.

`UpdateTemplate<O>` is defined for future use (v1 config updates). No templates currently
export an update function.

## Template Pattern

Every template follows the same structure:

```typescript
// 1. Define the options schema
export const FooOptions = Schema.Struct({
  required: Schema.String,
  optional: Schema.optional(Schema.Boolean),
});

// 2. Export the type alias
export type FooOptionsType = typeof FooOptions.Type;

// 3. Export the create function
export function createFoo(options: unknown): TemplateEntry[] {
  const opts = Schema.decodeUnknownSync(FooOptions)(options);
  // Pure content generation -- no side effects
  const content = JSON.stringify(config, null, "\t");
  return [{ name: "foo", filename: "foo.json", content }];
}
```

Key properties:

- **Input is `unknown`:** Schema validation at the boundary. Callers pass untyped data;
  the function validates or throws `ParseError`.
- **Output is `TemplateEntry[]`:** Most templates return a single entry. `vscode` returns
  two (settings + extensions). `workspace` returns many (composed from sub-templates).
- **Pure functions:** No I/O, no side effects, no mutable state.
- **JSON uses tabs:** All JSON output uses `JSON.stringify(obj, null, "\t")` for
  consistency with the Silk Suite style.

## Template Inventory

### 1. Package JSON (`package-json`)

**Function:** `createPackageJson(options)`
**Output:** `package.json` (single entry)

Options cover all standard package.json fields: `name` (required), `version` (default
`"0.0.0"`), `private`, `description`, `homepage`, `bugs`, `repository`, `license`,
`author`, `sideEffects`, `type`, `exports`, `scripts`, `dependencies`, `devDependencies`,
`peerDependencies`, `engines`, `packageManager`, `devEngines`, `publishConfig`, `keywords`.

Uses `sort-package-json` for consistent field ordering. Only includes non-empty/non-undefined
fields.

### 2. TSConfig (`tsconfig`)

**Function:** `createTsConfig(options)`
**Output:** `tsconfig.json` (single entry)

Options: `extends` (string or string[], always normalized to array), `composite`, `include`,
`exclude`, `references`. Minimal output -- most config lives in the extended base.

### 3. Biome (`biome`)

**Function:** `createBiome(options)`
**Output:** `biome.jsonc` (single entry)

Options: `version` (required, for `$schema` URL), `extends`, `root`. Generates
`$schema: "https://biomejs.dev/schemas/<version>/schema.json"`.

### 4. Turbo (`turbo`)

Two functions instead of one, because root and workspace turbo.json have different schemas:

**`createTurboRoot(options)`** -- Output: `turbo.json` with `$schema`, `tasks` (required),
`globalDependencies`, `globalEnv`, `globalPassThroughEnv`, `ui`, `concurrency`.

**`createTurboWorkspace(options)`** -- Output: `turbo.json` with `extends: ["//"]` and
optional `tasks` overrides.

### 5. pnpm Workspace (`pnpm`)

**Function:** `createPnpmWorkspace(options)`
**Output:** `pnpm-workspace.yaml` (single entry)

Options: `packages` (required, string[] of workspace glob patterns), `autoInstallPeers`,
`catalogMode` (`"strict" | "prefer" | "manual"`), `catalog`. Uses `js-yaml` for YAML
serialization.

### 6. Gitignore (`gitignore`)

**Function:** `createGitignore(options)`
**Output:** `.gitignore` (single entry)

Options: `sections` (`{ node?, build?, env?, os?, silk? }` booleans, all default `true`),
`additional` (extra patterns). Categorized sections with comment headers. Pure string
concatenation -- no template engine.

### 7. Changesets (`changeset`)

**Function:** `createChangeset(options)`
**Output:** `.changeset/config.json` (single entry)

Options: `access` (default `"restricted"`), `baseBranch` (default `"main"`), `changelog`
(default `"@savvy-web/changesets/changelog"`), `repo` (`"owner/repo"` pattern-validated).
Includes Silk Suite defaults for `commit`, `fixed`, `linked`, `updateInternalDependencies`,
`privatePackages`, `ignore`.

### 8. VS Code (`vscode`)

**Function:** `createVsCode(options)`
**Output:** Two entries: `.vscode/settings.json` and `.vscode/extensions.json`

Options: `settings` (`{ biome?, turbo?, vitest? }` booleans for conditional settings),
`extensions` (string[] of recommended extension IDs, sorted and deduplicated).

Conditionally includes Biome code actions, Turbo/Vitest exclude patterns, and toggles
ESLint/Prettier based on Biome presence.

### 9. README (`readme`)

**Function:** `createReadme(options)`
**Output:** `README.md` (single entry)

Options: `name` (required), `description`. Simple h1 + description. Intentionally minimal --
README content is project-specific.

### 10. Workspace (`workspace`)

**Function:** `createWorkspace(options)`
**Output:** Merged `TemplateEntry[]` from all enabled sub-templates

Options: `name` (required), `dirname`, `packageManager` (`"pnpm" | "npm" | "bun"`,
required), `packageManagerVersion` (required), `nodeVersion` (required), `features`
(`{ biome?, vitest?, turbo?, changesets?, vscode? }` booleans).

Master compositor that orchestrates all other templates. Always includes: package-json,
tsconfig, gitignore, readme. Conditionally includes: pnpm (when `packageManager === "pnpm"`),
biome, turbo, changeset, vscode (based on feature flags). The workspace template calls
sub-template `create*` functions directly, passing derived options.

## Dependencies

```text
@savvy-web/templates
  ├── effect (peer)           <- Schema validation only
  ├── sort-package-json       <- package.json field ordering
  └── js-yaml                 <- YAML serialization for pnpm-workspace.yaml
```

**No platform dependencies.** Unlike `@savvy-web/silk-effects`, this package does not depend
on `@effect/platform`, `workspaces-effect`, `jsonc-effect`, `yaml-effect`, or any other
Effect service package. These were explicitly dropped from the original spec because they
require Layer composition -- overkill for pure content generation. Templates use
`JSON.stringify`, `js-yaml`, and string construction directly.

**Dev dependencies:** `@savvy-web/rslib-builder` (build), `@savvy-web/vitest` (test),
`@types/js-yaml`, `@types/node`, `effect`.

**Build:** `@savvy-web/rslib-builder` with dual output (`dist/dev`, `dist/npm`). Dual-registry
publishing to npm and GitHub Packages via `publishConfig.targets`.

## Consumer Guide

### Installation

```bash
pnpm add @savvy-web/templates effect
```

### Usage

All exports come from the package root:

```typescript
import {
  createPackageJson,
  createTsConfig,
  createBiome,
  createTurboRoot,
  createTurboWorkspace,
  createPnpmWorkspace,
  createGitignore,
  createChangeset,
  createVsCode,
  createReadme,
  createWorkspace,
} from "@savvy-web/templates";
```

**Generate a single config:**

```typescript
const entries = createBiome({ version: "2.3.3", root: true });
// => [{ name: "biome", filename: "biome.jsonc", content: "..." }]
```

**Scaffold an entire workspace:**

```typescript
const entries = createWorkspace({
  name: "my-project",
  packageManager: "pnpm",
  packageManagerVersion: "10.33.0",
  nodeVersion: "24.11.0",
  features: { biome: true, turbo: true, changesets: true, vscode: true },
});
// => TemplateEntry[] with package.json, tsconfig.json, .gitignore, README.md,
//    pnpm-workspace.yaml, biome.jsonc, turbo.json, .changeset/config.json,
//    .vscode/settings.json, .vscode/extensions.json
```

**Write entries to disk (consumer responsibility):**

```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

for (const entry of entries) {
  const filepath = join(targetDir, entry.filename);
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, entry.content);
}
```

### Error Handling

Invalid options throw `ParseError` from Effect Schema. No custom error types:

```typescript
import { createBiome } from "@savvy-web/templates";

try {
  createBiome({ /* missing required 'version' */ });
} catch (err) {
  // err is a ParseError from @effect/schema
}
```

## Rationale

### Why pure functions instead of Effect services?

Templates generate content. They do not read files, write files, resolve paths, or interact
with the platform. Effect services add Layer composition overhead that provides no benefit
when the entire operation is `options => string`. Keeping templates as pure functions makes
them trivially testable, composable, and usable in any context without Effect runtime setup.

### Why no template engine (Handlebars, EJS, etc.)?

Template engines add complexity (partials, helpers, escaping) without benefit for structured
output. JSON configs are best built programmatically with `JSON.stringify`. YAML uses
`js-yaml`. Gitignore and README are simple string concatenation. TypeScript provides all
the control flow needed, with type safety that template engines cannot offer.

### Why a single entry point?

Same reasoning as `@savvy-web/silk-effects`: consumers should not need to know internal
module structure. A single root export with tree-shaking (`sideEffects: false`) gives the
simplest consumer experience while allowing bundlers to eliminate unused templates.

### Why `unknown` input instead of typed options?

Each `create*` function accepts `unknown` and validates with `Schema.decodeUnknownSync`.
This makes templates usable from untyped sources (CLI arguments, JSON config files, user
prompts) without requiring callers to pre-validate. TypeScript users still get type
inference from the exported `Schema` and `OptionsType` types.

### Why separate create functions instead of a single `generate(templateName, options)`?

Individual functions provide:

- TypeScript autocomplete for each template's options
- Tree-shaking of unused templates
- Clear, greppable call sites
- No string-based dispatch or registry lookup

### Why `TemplateEntry` instead of writing directly?

Separating content generation from I/O enables:

- Testing without filesystem mocking
- Preview/dry-run modes in consumers
- Custom path mapping (consumer decides where files go)
- Batching, diffing, or conflict resolution in the caller
- Use in both CLI tools and programmatic APIs

### Why drop Effect service dependencies?

The original spec considered using `jsonc-effect`, `yaml-effect`, and other Effect service
packages. These were dropped because they require Layer composition and platform
dependencies (`@effect/platform`). For a library that only serializes in-memory objects,
`JSON.stringify` and `js-yaml` are simpler, faster, and have zero runtime requirements.
