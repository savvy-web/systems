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
  - ./targets.md
  - ./exe.md
  - ./build-loop.md
  - ./meta.md
  - ../bundler/architecture.md
---

# The config validator

`src/config-validation/` is the fast-fail validator the bundler runs first over the resolved config, so a structurally bad `savvy.build.ts` or `publishConfig.targets` fails before any build work across the dev, prod, meta and exe paths. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The rule topology](#the-rule-topology)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`ConfigValidator` is a `Context.Service` class with one method, `validate(input: ValidationInput) → Effect<void, ConfigValidationError>`, and a `layer` static defined alongside it. `ValidationInput` is the normalized fact bundle the bundler assembles (base name, whether the package has exports, and the optional targets, exe, os/cpu, meta and loose-file config). The layer wraps a synchronous check in `Effect.try`, surfacing every throw as a typed `ConfigValidationError` failure.

## Current state

- `ConfigValidator`, `ConfigValidator.layer` and `ValidationInput` (`src/config-validation/ConfigValidator.ts`).
- `ConfigValidationError` (`src/errors.ts`).

## The rule topology

Every rule reuses the pure function the corresponding build path already uses; the validator adds the cross-field and presence checks, not a parallel rule set.

- **Targets** delegate to `resolveTargets` (see [The targets derivation](./targets.md)).
- **Exe** runs through `normalizeExeOptions` and then checks for an empty fileName and empty targets (see [The SEA exe wrapper](./exe.md)).
- **Meta** is gated behind a prerequisite cross-field guard — a package with no exports cannot emit an api-model, so that fails first — then validates tsdoc `tagDefinitions` syntax kinds and that any existing `localPaths` are directories (see [Meta generation](./meta.md)).
- **Loose files** delegate to `normalizeLooseFiles` for extension/format validation, so a malformed loose file fails for every target before any build (see [The build loop](./build-loop.md#loose-files)).

## Boundaries and invariants

- **`ConfigValidationError` is the single typed config error**, raised by the pure guards and re-surfaced by this layer; nothing here throws a plain `Error`.
- **No rule is defined twice.** The validator composes `resolveTargets`, `normalizeExeOptions` and `normalizeLooseFiles`; the build paths call the same functions.
- **The validator runs before any build work**, on every target path.

## Rationale

### Why a service over a plain function

The bundler's front door is an Effect program, and a typed `ConfigValidationError` in its failure channel is what lets it `catchTag` a config mistake apart from a build failure. Wrapping the synchronous checks in a layer keeps the checks themselves pure and directly reusable by the build paths, while the service form gives the orchestrator a single injectable seam.
