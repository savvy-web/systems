---
status: current
module: bundler
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ./self-hosting.md
  - ../rspress-builder/architecture.md
  - ../github-action-builder/architecture.md
  - ../silk/architecture.md
dependencies:
  - ./architecture.md
---

# @savvy-web/bundler shipped tsconfig preset

The shared TypeScript base preset the bundler ships and the self-containment rule every shipped preset in the suite follows. Part of the [bundler architecture](./architecture.md).

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The ecma.json preset](#the-ecmajson-preset)
- [Self-containment: shipped presets extend only relative files](#self-containment-shipped-presets-extend-only-relative-files)
- [The TS6 baseline](#the-ts6-baseline)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

The bundler is the **canonical build base** in the suite's TSConfig preset taxonomy: build tools own the lib/build base (self-contained, shipped with the tool) and silk owns the convention roots and framework configs (see `../silk/architecture.md`). Each build tool ships exactly the preset its package type needs — `@savvy-web/bundler/tsconfig/ecma.json` for a plain Node library, `@savvy-web/rspress-builder/tsconfig/plugin.json` for an RSPress plugin, `@savvy-web/github-action-builder/tsconfig/action.json` for a GitHub Action — and a consumer extends one of them once.

## Current state

Implemented. Every downstream package in the repo extends `@savvy-web/bundler/tsconfig/ecma.json`; the bundler and `tsdown-plugins` extend the file by relative path.

## The ecma.json preset

- **`packages/bundler/public/tsconfig/ecma.json`** is the tsdown library build base (`target: es2025`, `nodenext`, `strict`, `verbatimModuleSyntax`, `isolatedModules`, declaration emit). It is published via the `public/` copy convention and exported as `"./tsconfig/ecma.json"`. See the file for the authoritative `compilerOptions`.
- **The bundler extends its own copy by relative path** (`./public/tsconfig/ecma.json`), as does `tsdown-plugins` (`../bundler/public/tsconfig/ecma.json`), to avoid a build-before-typecheck cycle — the package specifier resolves only after the `public/` copy lands in `dist`.

## Self-containment: shipped presets extend only relative files

A shipped preset must be **self-contained**: it extends only relative files inside its own package, never a package specifier, and in practice none of the shipped presets uses `extends` at all. Two independent reasons compound into this rule:

1. **The transitive-dependency reason.** A consumer may carry the build tool only as a transitive dependency, and tsdown's tsconfig-`extends` loader resolves package specifiers from the project root and cannot reach a transitive dep. So `@savvy-web/rspress-builder`, which ships consumer presets a transitive consumer must resolve, keeps a byte-identical copy of the base at `packages/rspress-builder/public/ecma.json`, guarded by its `__test__/ecma-sync.test.ts`. See `../rspress-builder/architecture.md`.
2. **The replace-not-merge reason.** TypeScript's `extends` REPLACES array-valued compiler options (`types`, `lib`) rather than merging them — a consumer overriding either loses every entry the base declared, `node` included, which silently takes `console`/`process`/`Buffer` with it. Each shipped preset carries a top-level `"//"` annotation warning of this. Chaining a preset's own `extends` compounds the risk on every hop, so the presets are kept fully inlined even within the same package.

Every shipped preset sets `composite: false` (nothing in the repo uses project references, and a `composite: true` preset produced a spurious consumer warning) and includes `types/*.d.ts` rather than `types/*.ts` (a `types/` directory holds ambient declarations, not compilable source).

## The TS6 baseline

The shipped presets (and the silk convention presets) target TypeScript 6: they set `types` explicitly (TS6's default is `[]`), use `module: nodenext`/`node20`/`esnext` rather than the deprecated `node`/`node10` values and omit the redundant `dom.iterable` (subsumed by `dom`).

## Boundaries and invariants

- **Build tools own the build base; silk owns the convention roots.**
- **Shipped presets never `extends` a package specifier** and in practice carry no `extends` at all.
- **A package that must ship the base to transitive consumers keeps a byte-identical copy**, guarded by a sync test against `packages/bundler/public/tsconfig/ecma.json`.
- **The bundler and tsdown-plugins extend the base by relative path**, never by their own package specifier.

## Rationale

### Why the build tool ships the base

The base encodes what the build expects (`nodenext`, `verbatimModuleSyntax`, `isolatedModules`, declaration emit), so it belongs with the tool that enforces it. Shipping it from the bundler means a tsdown upgrade that changes those expectations ships the matching tsconfig in the same release.

### Why self-containment over composition

A one-preset-per-package-type taxonomy costs some duplication (the rspress-builder copy) but removes two failure modes at once: transitive consumers that cannot resolve a specifier, and multi-hop `extends` chains whose effective `types`/`lib` lists are hard to reason about under TypeScript's replace semantics.
