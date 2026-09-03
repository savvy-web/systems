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
  - ./meta-wiring.md
  - ./tsconfig-preset.md
  - ../tsdown-plugins/architecture.md
  - ../e2e/architecture.md
dependencies:
  - ./architecture.md
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/bundler self-hosting

How the bundler and `@savvy-web/tsdown-plugins` build themselves, and where the bundler's own tests live. Part of the [bundler architecture](./architecture.md).

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The bootstrap ladder](#the-bootstrap-ladder)
- [What the escape hatches reproduce](#what-the-escape-hatches-reproduce)
- [Turbo wiring](#turbo-wiring)
- [Where the tests live](#where-the-tests-live)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

Every in-repo package builds via the bundler stack, including the two packages that make up the stack. The chicken-and-egg of a builder building itself is resolved across three tiers, and the two upstream tiers are the in-repo instances of the published escape-hatch contract (see `../tsdown-plugins/architecture.md`).

## Current state

Implemented. Both escape-hatch builds are API-Extractor validated and stamp `issues.json` like the front door.

## The bootstrap ladder

- **Tier 1 — `@savvy-web/tsdown-plugins`** builds itself via an escape-hatch `savvy.build.ts` that imports `buildTargetGroups` from its **own `./src`**. It cannot use `defineBuild`/`runBuild` (those live downstream in the bundler), and it is the **one package whose build scripts run `tsx savvy.build.ts`**: Node's native type-stripping cannot run a file that imports its own un-built `./src`.
- **Tier 2 — `@savvy-web/bundler`** builds itself via an escape-hatch `savvy.build.ts` (`packages/bundler/savvy.build.ts`) that imports `buildTargetGroups` from the **already-built `@savvy-web/tsdown-plugins`** workspace link. It cannot use its own `defineBuild`/`runBuild`.
- **Tier 3 — every other package** calls the front-door `build()`, because the bundler is built by the time they run. `rspress-builder` self-hosts through the front door even though it wraps `runBuild` itself — `definePlugin` returns a plain `BuildConfig`.

## What the escape hatches reproduce

The two escape-hatch scripts port what `runBuild` would otherwise do for them: the package's externals and `defaultManifestTransform`, a `BuildCollector` threaded into `buildTargetGroups` and rendered via `renderReport`, `emitDeclarations: true` on prod, the `dist/prod/targets.json` binding via `writeTargetsBinding(resolveTargets(...))`, the shared `runMetaPass` (see [Meta wiring](./meta-wiring.md)) and `removeDeclarationMaps` AFTER meta. Both write `issues.json` from a `finally`, with the terminal error captured by a `catch` that rethrows unchanged, so a crashed self-build stamps `buildOk: false` exactly like the front door.

The bundler's own script must keep `rolldown` out of `bundledPackages`/`bundleNodeModules` so the `Plugin` type stays an external reference in its emitted `.d.ts` (see [Build options](./build-options.md)).

## Turbo wiring

The root `turbo.json` carries the generic `build:dev`/`build:prod`/`types:check` tasks; its `*.ts` input glob covers `savvy.build.ts`, so most child `turbo.json`s only extend the root. `build:prod` depends on `types:check` and `build:dev`, and its inputs include `$TURBO_ROOT$/.changeset/**` so a changeset edit invalidates the cached prod build and recomputes the optimistic meta. A package whose meta pass copies into the website model sink (the bundler included) widens `build:prod` outputs in its own `turbo.json` to cover that path.

## Where the tests live

- **`packages/bundler/__test__/`** — unit tests of `runBuild` with injected IO, plus integration fixtures under `__test__/integration/` that import the source under test (`src/config.js`/`src/run.js`), not the built package. They are integration tests of the bundler source, not e2e tests of the tarball, so the bundler carries no `types:check → build:dev` self-dependency.
- **`e2e/bundler`** — the built-artifact harness that spawns the built front door (and the escape hatch) against isolated fixtures. Any coverage that needs a dependency resolved from a real consumer context — `bundleNodeModules`, catalog resolution — belongs there, not in `packages/bundler/__test__/`. See `../e2e/architecture.md`.

## Boundaries and invariants

- **The two upstream packages self-build through escape hatches; everything else uses the front door.**
- **Escape hatches call the same helpers as `runBuild`** — `buildTargetGroups`, `runMetaPass`, `writeTargetsBinding`, `writeIssuesArtifact` — never a private path.
- **`tsdown-plugins` is the only `tsx` build script.**
- **In-package tests import source; built-artifact checks live in `e2e/`.**

## Rationale

### Why escape hatches rather than a pre-built bootstrap copy

Building the two upstream packages with the same public helpers the escape-hatch contract promises consumers keeps that contract exercised on every build. A vendored bootstrap binary would let the helpers drift from what the front door actually needs.
