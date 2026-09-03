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
  - ./build-options.md
  - ../tsdown-plugins/architecture.md
dependencies:
  - ./architecture.md
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/bundler exe wiring

How a package that ships a single-executable (SEA) binary is built. Part of the [bundler architecture](./architecture.md); the compile wrapper, filename computation and manifest rewrite live in `../tsdown-plugins/architecture.md` (`src/exe/`, `src/entry/`, `src/manifest/`).

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [SEA compilation is a step of every build](#sea-compilation-is-a-step-of-every-build)
- [The manifest is programmed, never hand-written](#the-manifest-is-programmed-never-hand-written)
- [Flags and the standalone target](#flags-and-the-standalone-target)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

A package configures `defineBuild({ exe })` (`ExeConfig`, re-exported from `@savvy-web/tsdown-plugins`). SEA compilation is then a **step of every `--target dev`/`--target prod` build**: a normal build emits the binary AND programs the manifest to point at it. `@tsdown/exe` is a runtime dependency of the bundler (not of tsdown-plugins); tsdown lazily imports it only when the exe option is used, which keeps tsdown-plugins interface-only while the bundler ships the SEA toolchain.

## Current state

Implemented. Real binary compilation is covered by a darwin-arm64-gated integration test under `packages/bundler/__test__/integration/`; the unit tests inject a fake `runExeBuild` and assert the wiring.

## SEA compilation is a step of every build

- **One binary, one target.** `runBuild` normalizes the spec with `normalizeExeOptions` and THROWS unless exactly one spec with exactly one target results: a package's `exports["."]` resolves to a single SEA, so cross-platform binaries ship as separate per-platform packages rather than one manifest silently programmed for the first of several.
- **The filename is computed, never guessed.** `computeExeFileName(fileName, target)` mirrors `@tsdown/exe`'s output naming and is the single source of truth, so the manifest value cannot drift from the on-disk file. After a real compile `runBuild` asserts the file exists at the computed name (skipped when a fake `runExeBuild` is injected).
- **The exe entry is excluded from the JS pass.** `packageJsonEntries({ excludeSources })` drops any `exports`/`bin` value equal to the resolved `exe.entry` (default `./src/bin.ts`), so a pure-binary package yields ZERO JS entries — no dead `bin/<cmd>.js` stub, no `No input files`. A library-plus-binary package still compiles its other exports.
- **The SEA is compiled LAST**, in `run.ts` after `buildTargetGroups`, into each built group's `pkg/bin` (`dist/dev/pkg/bin`; `dist/prod/<group>/pkg/bin`), so the JS pass's `clean` cannot wipe it.

## The manifest is programmed, never hand-written

`runBuild` builds an `exeRewrite` (`{ source, fileName, dir: "bin" }`) and threads it into `buildTargetGroups`, where the manifest-emit plugin rewrites every `exports`/`bin` value equal to the exe source to the emitted SEA path (a plain string — a SEA has no `.d.ts`) and adds the binary to `files`. A per-platform package therefore exposes its suffixed binary at `exports["."]` and a consumer resolves it with `require.resolve(packageName)`.

For a pure-binary package the JS pass is skipped, so the manifest-emit plugin never runs; `runBuild` emits the manifest (plus LICENSE/README) standalone in the exe step via `buildEmittedManifest`. The prod meta pass is skipped for an exe-only package (no dts to extract).

## Flags and the standalone target

- **`--no-exe`** programs the manifest with the computed name but skips the compile. `prepare` and frozen-lockfile installs use it so they never cross-compile a SEA (a Windows SEA's tar-extract fails on Linux install steps); `build:dev`/`build:prod` do the real cross-compile.
- **`--target exe`** is a manual escape hatch that compiles into `dist/dev/pkg/bin` and throws if the config has no `exe`. It runs no library build.

## Boundaries and invariants

- **The bundler wires; tsdown-plugins owns the behavior** — filename computation, entry exclusion, the manifest rewrite and the compile wrapper.
- **Exactly one binary with one target per package.**
- **The manifest is always programmed from the computed filename**, whether or not the compile runs.
- **`@tsdown/exe` is a bundler runtime dependency, never a peer.**

## Rationale

### Why compile inside dev and prod rather than only a standalone target

A binary that only existed under a separate target left the manifest pointing at a file that a normal build never produced. Making the SEA a step of every build, with the manifest programmed from a computed name, means the published `pkg/` is always self-consistent and an author never hand-writes a platform-suffixed filename.

### Why per-platform packages

Programming `exports["."]` for one binary keeps the consumer contract trivial (`require.resolve`) and matches the NAPI-RS/rspack convention. Multi-target support would need a conditional manifest per platform that npm cannot express in a single package.
