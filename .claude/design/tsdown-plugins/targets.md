---
status: current
module: tsdown-plugins
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ./build-loop.md
  - ./entry-and-manifest.md
  - ./config-validation.md
  - ../bundler/architecture.md
  - ../silk-effects/architecture.md
---

# The targets derivation

`src/targets/` is the single source of truth for turning `publishConfig.targets` into the groups to build and the registry endpoints to publish them to. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Resolution rules](#resolution-rules)
- [The binding artifact](#the-binding-artifact)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

The bundler reads `publishConfig.targets`, calls `resolveTargets` and threads the result into the build loop and the binding artifact; it owns no derivation logic (see `../bundler/architecture.md`). Both self-hosting escape hatches call the same two functions on `--target prod`, so every in-repo package emits a binding.

## Current state

- `resolveTargets`/`isTargetObject` and the `PublishTargets`/`TargetResolution`/`ResolvedGroup`/`ResolvedTarget` types (`src/targets/resolve-targets.ts`, `src/targets/config.ts`).
- `writeTargetsBinding` (`src/targets/binding.ts`).

## Resolution rules

`resolveTargets({ targets, baseName })` is pure and returns `{ groups, targets }`:

- **Groups are byte-variants.** Every `true` target collapses into one canonical base-name group (folder id `npm` if present, else the first true id). A string or object `name` override gets its own group whose folder id is its key and whose manifest name is the override — the declarative rename the manifest emitter applies (see [Entry detection and manifest emission](./entry-and-manifest.md#manifest-emission)). A group dir is always `dist/prod/<id>/pkg`.
- **`from` reuses bytes.** An object target with `from: <id>` adds no group; it binds a registry endpoint to a referenced group's already-built bytes — the N-targets-to-one-group relationship made declarative.
- **Default registries** fill in for the well-known keys (`npm`, `github`); a custom key must supply `{ registry }`.
- **Structural validation throws `ConfigValidationError`** synchronously; the case list lives in `resolve-targets.ts`. The [config validator](./config-validation.md) delegates to this function and re-surfaces the throw as a typed Effect failure.

## The binding artifact

`writeTargetsBinding(cwd, resolution)` writes the `TargetResolution` to `dist/prod/targets.json` and returns the path. It is the bundler-to-release contract: it records which groups exist and which registry each target deploys to, so the publishing side uploads the built `dist/prod/<id>/pkg` bytes to the right endpoints without re-deriving anything. `@savvy-web/silk-effects` consumes it at publish-target resolution time (see `../silk-effects/architecture.md`).

## Boundaries and invariants

- **`resolveTargets` is the single source of truth.** The bundler, the validator and the publishing side derive from it rather than reimplementing the mapping.
- **A group id is any string** — a prod group id is an arbitrary `publishConfig.targets` key — and the loop input `BuildGroupSpec` carries `{ id, name }` so each group threads its own manifest name.
- **The rename is the only mechanism that produces distinct publishable bytes** across groups; `from` targets share bytes by construction.

## Rationale

### Why groups and targets are separate

Registries and byte-variants are different cardinalities: two registries usually want the same bytes, and one registry sometimes wants a renamed manifest. Modelling groups as byte-variants and targets as endpoints bound to a group lets `from` express sharing declaratively instead of the build producing duplicate directories or the publisher guessing which one to upload.
