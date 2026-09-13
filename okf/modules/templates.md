---
type: Module
title: templates
description: Pure-function project scaffolding library — stateless functions that turn typed options into generated file content, with no I/O of its own.
kind: package
resource: ../../packages/templates
status: draft
tags: [tooling]
sources:
  - id: arch
    resource: ../../packages/templates/src
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: ae24779bc58a4a9fe9f56c0aa1c3430e2d2ddcc4be49055dd6046183d2514891
---

# templates

## Boundary

`@savvy-web/templates` (`packages/templates`) is a pure TypeScript library that generates project configuration content from typed options. Stateless functions take options and return `TemplateEntry[]`; the library performs no I/O, no file writing, no prompting and no path resolution — consumers decide what to do with the output.[^arch] It runs in any JavaScript runtime with no platform dependencies. Nothing else in this repo consumes it; its consumers are external projects.[^arch]

## Owner

Each template is a single-file module under `src/lib/<name>/index.ts`, with shared types in `src/lib/types.ts` and the workspace compositor in `src/lib/workspace/index.ts`. The public API is a single root export (`.`) re-exported from `src/index.ts`, authoritative for the export surface.[^arch]

## Core contract

Every template module exports a `Schema` (an Effect Schema struct), an `OptionsType` type alias, and a `create*(options: unknown)` function that validates and returns `TemplateEntry[]`.[^arch] `TemplateEntry` (`src/lib/types.ts`) carries `name`, `filename` (a suggested path, not a filesystem assertion) and `content`.[^arch] Input is always `unknown`, validated at the boundary with `Schema.decodeUnknownSync`; invalid input throws `ParseError`, the package's only error path.[^arch]

`createWorkspace` is the compositor: it calls the other templates' `create*` functions directly with derived options, always emitting package-json, tsconfig, gitignore and readme, and conditionally adding pnpm, biome, turbo, changeset and vscode based on `features` flags.[^arch]

## Boundaries and invariants

- **Pure functions, not Effect services.** Templates generate content only; they never read files, write files, resolve paths or interact with the platform, so Layer composition would add overhead with no benefit.[^arch] The one Effect executed anywhere in the package is `@effected/yaml`'s `Yaml.stringify` inside `createPnpmWorkspace`, run synchronously and requiring no services.[^arch]
- **No template engine.** JSON configs are built with `JSON.stringify(obj, null, "\t")` to match the Silk Suite tab style; YAML goes through `@effected/yaml`; gitignore and README are plain string concatenation.[^arch]
- **`UpdateTemplate<O>` is a type contract only** — no template module implements an update function.[^arch]
- **Runtime dependencies are `@effected/package-json` and `@effected/yaml` only**; `effect` is a peer, used for Schema validation and the one YAML-serialization Effect. The package has no platform dependencies and, unlike `@savvy-web/silk-effects`, does not depend on `@effect/platform` or any Effect service needing a Layer.[^arch]
- **The package builds with `@savvy-web/bundler`** through the `build()` front door; see `savvy.build.ts` and `publishConfig.targets` for the build wiring and dual-registry publishing.[^arch]

[^arch]: `../../packages/templates/src`
