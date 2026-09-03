---
status: current
module: tsdown-plugins
category: architecture
created: 2026-06-05
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./entry-and-manifest.md
  - ./build-loop.md
  - ./dts-emission.md
  - ./dual-format.md
  - ./report.md
  - ./meta.md
  - ./targets.md
  - ./exe.md
  - ./config-validation.md
  - ../bundler/architecture.md
  - ../rspress-builder/architecture.md
  - ../e2e/architecture.md
---

# @savvy-web/tsdown-plugins architecture

The interface-only plugin pack holding every build behavior `@savvy-web/bundler` orchestrates. This doc is the overview: the package boundary, the Effect posture, the escape-hatch contract and the cross-cutting invariants. Each subsystem has its own doc, linked from [Overview](#overview).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The interface-only boundary](#the-interface-only-boundary)
- [The Effect posture](#the-effect-posture)
- [The escape-hatch contract](#the-escape-hatch-contract)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/tsdown-plugins` is the building blocks; `@savvy-web/bundler` is the thin orchestrator over them (see `../bundler/architecture.md`). Everything the bundler's front door does is exposed here as a helper or a rolldown `Plugin`, so a hand-written `savvy.build.ts` or `tsdown.config.ts` reproduces the front door by importing the same surface.

The subsystems, one doc each:

- [Entry detection and manifest emission](./entry-and-manifest.md) — deriving tsdown entries from `exports`/`bin`, the published-manifest transform, ambient `.d.ts` exports and catalog resolution delegated to the `@effected` kit.
- [The build loop](./build-loop.md) — `buildTargetGroups`: the per-TargetGroup passes, entry partitions and overrides, web-runtime partitions, loose files, the bundling posture knobs, the `define` map and the `public/` sync.
- [Declaration emission](./dts-emission.md) — the resolved dts tsconfig, the TypeScript 6 pin, per-entry bundled rollups and their determinism, the re-export stub, JSX resolution and the declaration source-map stripper.
- [Dual-format output](./dual-format.md) — what changes when `cjs` is in the format and the two cjs interop plugins that make the emitted `.cjs` work.
- [The build report](./report.md) — the `BuildCollector`, its capture seams, the Effect reporter pipeline and the persisted `issues.json` artifact.
- [Meta generation](./meta.md) — `runMetaPass` over API Extractor: the api-model bundle, the two-input diagnostics split, message routing and optimistic next-versions.
- [The targets derivation](./targets.md) — `publishConfig.targets` to build groups and registry endpoints, and the `targets.json` binding.
- [The SEA exe wrapper](./exe.md) — the interface-only wrapper over tsdown's exe mode.
- [The config validator](./config-validation.md) — the fast-fail `ConfigValidator` service the bundler runs first.

## Current state

**Package:** `@savvy-web/tsdown-plugins` at `packages/tsdown-plugins`. **Public surface:** `src/index.ts`, the semver'd export surface. **Versioning:** independent; a release auto-bumps the bundler through the dependency relationship.

Source is split by concern: `src/entry/`, `src/manifest/`, `src/catalog/`, `src/dts/`, `src/build/`, `src/report/`, `src/meta/`, `src/targets/`, `src/jsx/`, `src/exe/`, `src/config-validation/`, plus `src/errors.ts` (the `Data.TaggedError` set) and `src/tsconfig/sync-options.ts` (the Node sync fs/path ops injected into every `@effected/tsconfig-json` loader call). See `package.json` for the dependency list; the shape that matters is in [The interface-only boundary](#the-interface-only-boundary) and [The Effect posture](#the-effect-posture).

**The package self-hosts.** `savvy.build.ts` is an escape-hatch build importing `buildTargetGroups`, `runMetaPass`, `writeTargetsBinding` and `writeIssuesArtifact` from its own un-built `./src`, bootstrapped by `tsx` because the file imports source that no built copy exists for yet. On `--target prod` it emits its own api-model, `targets.json` and `issues.json`, mirroring the front door. Its `tsconfig.json` extends the bundler's `public/tsconfig/ecma.json` by relative path because this package is upstream of the bundler and cannot resolve the package specifier. `typescript` is externalized from the self-build so the compiler is not inlined.

## The interface-only boundary

The cardinal decision: **plugins are authored against `import type { Plugin } from "rolldown"` only.** Rolldown stays type-only, a devDependency with no runtime import anywhere in `src`. tsdown is a declared runtime `dependency`, not a peer, but source touches it at exactly two injectable seams that fall back to a lazy `await import("tsdown")` only when the caller does not inject a `build` fn: `buildTargetGroups` (`src/build/build-target-groups.ts`) and `runExeBuild` (`src/exe/build.ts`).

- tsdown is a dependency so its dts passes resolve against this package's own pinned `typescript` in every install topology rather than a host-hoisted tsdown peered against whatever TypeScript major the consumer's workspace pins. See [Declaration emission](./dts-emission.md#the-typescript-6-pin).
- No rolldown peer. Plugins target rolldown's plugin type; the runtime is whatever tsdown bundles.
- Effect lives behind the boundary. Plugin hooks and `resolveManifest` present plain values (`Plugin`, `Promise`); the reporter Effect is run at the consumer's call site.

## The Effect posture

The package runs on Effect v4 (`catalog:effect`): `Context.Service` classes with `layer` statics, `Schema`, `Data.TaggedError`. The peer closure on v4 is `effect` alone, and it is declared as a regular `dependency` — there is **no `peerDependencies` block**. `@effect/platform-node` supplies `NodeFileSystem`/`NodePath` at the resolution boundaries.

Foundation capability comes from the `@effected/*` kit rather than local code: `@effected/workspaces` + `@effected/npm` (catalog and `workspace:` resolution, `DependencySpecifier` predicates, `WorkspaceDiscovery`), `@effected/tsconfig-json` (`extends` merging, JSONC, the portable-config allow-list, the `jsx` mapping) and `@effected/package-json` (manifest key ordering). JSON Schema output comes from core `effect`'s `JsonSchema`. The authority on kit and core APIs is the installed `.d.ts` and the vendored `.repos/effect` checkout, never recalled v3 shapes.

## The escape-hatch contract

A power user composes the same pieces by hand — `packages/tsdown-plugins/savvy.build.ts` and `packages/bundler/savvy.build.ts` are the two in-repo examples. Four guarantees hold it together: **parity** (the helpers *are* the front door's building blocks), **stability** (`src/index.ts` is the semver'd surface, not leaked bundler internals), **interface-only coupling** (rolldown by type only; the caller may inject its own tsdown `build`) and **no second-class paths** (anything the orchestrator does that is not a plugin — the multi-group loop, the meta pass — is still an exported helper).

## Boundaries and invariants

Per-subsystem invariants live in the child docs. These are the cross-cutting ones:

- **Interface-only to rolldown; tsdown only at the two injectable seams.** No rolldown runtime import, no tsdown peer.
- **No `peerDependencies`; `effect` is a regular dependency.** A consumer workspace's own Effect major can never poison this package's resolution under `autoInstallPeers`.
- **The kit owns catalog, tsconfig and JSX semantics.** This package re-exports the kit's catalog errors rather than defining twins, injects Node's sync ops into the tsconfig loader and owns only its override precedence and return shapes.
- **`ConfigValidationError` is the single typed config error.** Every structural-config guard — `resolveTargets`, `normalizeLooseFiles`, the ambient-dts checks, the exe/meta rules — throws it; the `ConfigValidator` layer re-surfaces the same throws as a typed Effect failure. `MetaGenerationError` is the meta pass's typed failure. Both live in `src/errors.ts`.
- **Effect stays behind the boundary.** Plugin objects and `resolveManifest` are plain values or Promises; the reporter Effect is run by the consumer.
- **`src/index.ts` is the semver'd contract** that the escape hatch and the bundler both depend on.
- **This package must not import `@savvy-web/silk-effects`**, which is downstream of this toolchain; importing it would create a package build cycle. `resolveNextVersions` is the deliberate second copy of the release-plan slice for that reason (see [Meta generation](./meta.md)).

## Rationale

### Why a dependency, not a peer

A maintained peer on the bundler core is exactly the drift this design avoids — the predecessor toolchain carried a maintained `@rslib/core` peer that had to be firefought across the ecosystem on every upgrade. A peer on tsdown would also put its resolution back under the consumer workspace's control: an undeclared or peer tsdown resolves against whatever TypeScript major the consumer's workspace root pins, which broke declaration emit outright once that major was TypeScript 7. A direct dependency lets this package resolve tsdown against its own pinned, known-good `typescript`, while a tsdown upgrade stays a single bundler-adjacent release rather than an ecosystem-wide peer bump.

### Why Effect is a dependency, not a peer

Effect is an implementation detail of the build toolchain, not an API surface the consumer provides. When it was a peer, a consumer on a different Effect major poisoned peer resolution at the consumer's importer level and crashed every `savvy.build.ts` with `ERR_MODULE_NOT_FOUND`. Declaring it as a regular dependency seals the graph; on v4 the whole peer closure is `effect` itself, so one dependency is enough. `@savvy-web/cli` and `@savvy-web/mcp` take the same posture. The opposite library posture — `effect` as a devDependency plus a required peer — is correct only for packages whose consumers *do* provide the Effect runtime, which is what `@savvy-web/silk-effects` and the `@effected/*` kit do.
