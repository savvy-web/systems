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
  - ./entry-and-manifest.md
  - ./report.md
  - ./config-validation.md
  - ../bundler/architecture.md
---

# The SEA exe wrapper

`src/exe/` is the interface-only wrapper over tsdown's exe (single-executable application) mode for packages that ship a binary. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The three units](#the-three-units)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

The bundler's `--target exe` normalizes the package's `exe` config, computes the emitted filename, rewrites the manifest to point at it and runs one tsdown exe build per spec — every step through helpers here. The `@tsdown/exe` runtime dependency lives on the bundler, not this package; tsdown lazily imports it when the exe option is used.

## Current state

- `normalizeExeOptions`, `DEFAULT_EXE_NODE_VERSION` and the `ExeConfig`/`NormalizedExe`/`ExeTarget` types (`src/exe/config.ts`).
- `computeExeFileName` (`src/exe/filename.ts`).
- `runExeBuild` and the loose-typed `ExeBuild` seam (`src/exe/build.ts`).

## The three units

- **`normalizeExeOptions(exe, pkgOsCpu)`** (pure) turns the `ExeConfig` (object or array) into one fully resolved `NormalizedExe` per binary: entry, targets inferred from the package's `os`/`cpu` when not stated, node version and SEA config defaults. It does no structural validation — the empty-fileName and empty-targets checks live in the [config validator](./config-validation.md).
- **`computeExeFileName(fileName, target)`** mirrors tsdown's own output naming (`<name>-<platform>-<arch>`, `.exe` on win) so the manifest value never drifts from the on-disk file. The bundler feeds it into the `ExeRewrite` the manifest transform applies — the exe entry's export/bin values are repointed at the SEA path and it is added to `files` (see [Entry detection and manifest emission](./entry-and-manifest.md#manifest-emission)).
- **`runExeBuild(options)`** runs one tsdown build per spec in exe mode, esm, node platform, with `deps.alwaysBundle` covering everything that is not a `node:` builtin — a SEA must bundle every non-builtin import because nothing is resolvable from disk inside the binary. The tsdown `build` fn is injectable with a lazy `import("tsdown")` default, and `ExeBuild` is deliberately loose-typed so no tsdown runtime type leaks in. Like the build loop it takes the optional `collector`/`verbose`/`groupId` and instruments the `exe` pass when present, byte-identical when absent (see [The build report](./report.md)).

Real binary compilation is a CI/mac-runner step outside the hermetic test suite; the in-repo tests inject a fake build and assert the spec and options.

## Boundaries and invariants

- **The exe path keeps the interface-only boundary.** tsdown is touched only through the injectable `ExeBuild` seam; `@tsdown/exe` is the bundler's dependency.
- **`computeExeFileName` is the single source of the SEA filename** for both the emitted file and the manifest rewrite.
- **Structural exe validation lives in the validator**, not in normalization.

## Rationale

### Why the wrapper is loose-typed

Importing tsdown's exe option types would make this package depend on tsdown's type surface at build time and drag `@tsdown/exe` into its graph. A `config: unknown` seam keeps the coupling at the value level, keeps the package unit-testable with a fake build and leaves the escape-hatch user free to bring their own tsdown.
