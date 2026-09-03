---
status: current
module: bundler
category: architecture
created: 2026-06-05
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./build-options.md
  - ./meta-wiring.md
  - ./exe-wiring.md
  - ./self-hosting.md
  - ./tsconfig-preset.md
  - ../tsdown-plugins/architecture.md
  - ../cli/architecture.md
  - ../github-action-builder/architecture.md
  - ../rspress-builder/architecture.md
  - ../silk/architecture.md
  - ../e2e/architecture.md
dependencies:
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/bundler architecture

The tsdown-based build orchestrator for Silk Suite TypeScript packages. A consumer installs one devDependency (`@savvy-web/bundler`), writes a self-executing `savvy.build.ts` and gets a pinned, tested `tsdown` transitively. Every package in this repo builds through this stack.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [Design docs in this module](#design-docs-in-this-module)
- [The two-package split](#the-two-package-split)
- [The savvy.build.ts contract](#the-savvybuildts-contract)
- [build, defineBuild and runBuild](#build-definebuild-and-runbuild)
- [TargetGroup and Target model](#targetgroup-and-target-model)
- [Multi-target publishing](#multi-target-publishing)
- [Dist layout](#dist-layout)
- [The orchestrator to tsdown boundary](#the-orchestrator-to-tsdown-boundary)
- [Catalog resolution and the process.cwd() constraint](#catalog-resolution-and-the-processcwd-constraint)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/bundler` is a thin orchestrator. It reads a package's `package.json` and its `savvy.build.ts`, derives per-TargetGroup tsdown options and drives tsdown's programmatic `build()` once per group. Every build behavior — entry detection, manifest emission, catalog resolution, the dts tsconfig port, the per-group loop, the meta pass, the output reporter — lives in `@savvy-web/tsdown-plugins`. The bundler imports those helpers and wires them; it owns no build logic beyond the `savvy.build.ts` contract, arg parsing and the ordering of the phases.

**Package:** `packages/bundler`. **Source:** `src/config.ts` (the `defineBuild` contract and `parseArgs`), `src/run.ts` (the `runBuild` orchestrator and the `build` front door), `src/index.ts` (the public surface, which also re-exports the option types from `@savvy-web/tsdown-plugins` and rolldown's `Plugin`). **Versioning:** independent; changesets auto-bumps it when `@savvy-web/tsdown-plugins` changes because of the ordinary dependency relationship.

**Build mode versus publish-target name.** `--target <dev|prod|meta|exe>` selects the build *mode* — `prod` builds the `dist/prod/` folder. A publish-target *name* (`npm`, `github`, a custom key) is a `publishConfig.targets` key and the `dist/prod/<name>/` folder id. `--target prod` builds the prod folder; `npm` is the default publish-target name within it.

## Current state

Implemented and in use by every package in the repo: the `dev`/`prod`/`exe` build modes, multi-target group derivation, dual-format output, the bundling-posture knobs, per-entry overrides, loose files, meta generation inside `--target prod`, SEA compilation, ambient `.d.ts` exports, the `issues.json` artifact and the self-hosting escape hatch. `--target meta` is accepted but is a deprecated no-op that prints a warning; meta is a function of `--target prod`.

Known gaps, all deferred: no collision guard between a loose file and a real export's emitted filename; the ambient `outName` is not added to a `files` allowlist; `deriveExportPaths` handles plain string exports only (no in-repo package uses conditional exports). `BuildConfigInput` still carries a dead `formats` field beside the live `format` — only `format` is read.

## Design docs in this module

- [Build options](./build-options.md) — the `defineBuild` option surface: output format, bundling posture, per-entry overrides, loose files, `define`/`plugins`, the manifest and minify defaults, `emitDts`, JSX and ambient `.d.ts` exports.
- [Meta wiring](./meta-wiring.md) — when and where the API-model (meta) pass runs inside `--target prod`.
- [Exe wiring](./exe-wiring.md) — how a single-executable (SEA) binary is compiled and programmed into the manifest.
- [Self-hosting](./self-hosting.md) — the bootstrap ladder by which the bundler and `tsdown-plugins` build themselves, plus where the bundler's own tests live.
- [The shipped tsconfig preset](./tsconfig-preset.md) — `@savvy-web/bundler/tsconfig/ecma.json` and the self-containment rule for shipped presets.

## The two-package split

The program is two packages, split on an interface boundary:

- **`@savvy-web/tsdown-plugins`** — the plugin pack. Interface-only coupling to tsdown (authored against rolldown's `Plugin` *type*). Holds every build behavior as composable helpers and plugins. See `../tsdown-plugins/architecture.md`.
- **`@savvy-web/bundler`** — this package. Depends on `tsdown-plugins`, `tsdown`, `rolldown` and `@tsdown/exe` as regular `dependencies`, drives tsdown's `build()` API, configured by `savvy.build.ts`.

The split buys two things. First, **no peer-sync trap**: the common-path consumer installs one devDependency and a tsdown upgrade becomes a bundler release, not an ecosystem-wide peer bump. Second, a **real published escape hatch**: a power user brings their own `tsdown` + `@savvy-web/tsdown-plugins` and composes the same helpers in a hand-written build script. The orchestrator is not a privileged path — anything it does, including the multi-group loop and the meta pass, is exposed as a helper. See the escape-hatch contract in `../tsdown-plugins/architecture.md`.

## The savvy.build.ts contract

A package configures the bundler with a `savvy.build.ts` that is a self-executing script calling the `build()` front door:

```ts
import { build } from "@savvy-web/bundler";

await build({
  format: ["esm", "cjs"],
  externals: ["typescript"],
});
```

- **No bin.** `package.json` scripts run the file directly: `"build:dev": "node savvy.build.ts --target dev"`, `"build:prod": "node savvy.build.ts --target prod"`. Node 24's native type-stripping runs the file; there is no `tsx` fallback except in `tsdown-plugins` (see [Self-hosting](./self-hosting.md)).
- **No boilerplate.** `build()` derives `cwd` from `dirname(process.argv[1])` and `argv` from `process.argv.slice(2)`, so the build file reads no process metadata by hand.
- **Arg surface:** `--target <dev|prod|meta|exe>` (default `dev`), `--watch`, `--no-exe` and `--verbose` (per-pass file table with byte sizes instead of the one-line-per-group summary). See `parseArgs` in `src/config.ts`.
- **Options:** see [Build options](./build-options.md), [Meta wiring](./meta-wiring.md) and [Exe wiring](./exe-wiring.md). `BuildConfigInput` in `src/config.ts` is the authoritative shape.

## build, defineBuild and runBuild

`build(input?, overrides?)` (`src/run.ts`) is the front door: it calls `runBuild(defineBuild(input), { cwd, argv, ...overrides })`. The optional partial `RunOptions` `overrides` is the IO seam — every IO dependency (`buildTargetGroups`, `writeOutput`, `readExports`, `runExeBuild`, `generateMeta`, `writeIssues` and the rest) is injectable so the orchestration is unit-testable without touching disk or spawning tsdown. Escape hatches and tests call `defineBuild`/`runBuild` directly.

- **`defineBuild(input)`** (`src/config.ts`) normalizes the config into a `BuildConfig`, applying the defaults (`devManifest: "preserve"`, `transform: defaultManifestTransform`, `minify: false`, `emitDts: true`). It is pure and never runs the build.
- **`runBuild(config, options)`** (`src/run.ts`) is the orchestrator. In order: parse argv → read `package.json` at cwd → resolve the effective JSX config and write the resolved dts tsconfig → derive entries from the (injectable) exports map → run `ConfigValidator.validate` over the assembled `ValidationInput` to fast-fail structurally bad config on every target path → normalize the exe spec and validate `outSubdir` overrides and ambient exports → short-circuit `--target meta` (warn) and `--target exe` (compile only) → resolve per-entry `overrides` into base + override partitions and normalize `looseFiles` → derive the build groups (one `dev` group, or every prod group from `publishConfig.targets`) → call `buildTargetGroups` with the knobs conditional-spread in (`emitDeclarations: true` on prod) → on prod, write `dist/prod/targets.json`, run `runMetaPass`, then `removeDeclarationMaps` on each prod `pkg/` → compile the SEA into each group's `pkg/bin` → write `dist/<target>/issues.json` → render one unified log from `collector.snapshot(packageName)`.
- **Config validation is structural only.** The rule set is `@savvy-web/tsdown-plugins`' `ConfigValidator`; the bundler assembles the input (base name, `hasExports`, `targets`, `exe`, `osCpu`, `meta`, `looseFiles`) and runs it via `Effect.runPromise` over `ConfigValidator.layer`. A failure is a typed `ConfigValidationError`. Two further fast-fails live in `run.ts` itself: an `exe` config must resolve to exactly one binary with one target, and a types-only package (ambient `.d.ts` exports, no JS entry, no exe) is rejected rather than letting tsdown throw an opaque `No input files`.

**The issues artifact is written on every terminal path and stamps the outcome.** `writeIssuesBestEffort(err?)` runs on the success path and in the `catch` before the rethrow; the `try` opens right after the `BuildCollector` is created so setup and validation failures are covered too. The artifact is persisted BEFORE the log renders on both paths, and the `catch`'s render is wrapped in its own swallow, so a renderer failure can neither lose the artifact nor displace the original error. The write passes `buildOk` plus, on failure, a `failure: { name?, message }` reduced by `describeFailure` — without that stamp a crash that produced zero diagnostics would be byte-identical to a clean gate, so **readers gate on `buildOk`, not on `errors.length`**. The artifact contract lives in `../tsdown-plugins/architecture.md`.

**The build log is unified from a collector.** `runBuild` threads one `BuildCollector` (owned by tsdown-plugins) through `buildTargetGroups`, the meta pass and the exe builds and renders a single log via `renderReport`/`ReportPipeline`, honoring `--verbose`, `NO_COLOR`/TTY and an explicit `output.format`. `renderAndWrite` is assigned only once the flags are resolved, so the `catch` checks for it before rendering.

## TargetGroup and Target model

- **TargetGroup** — a single build output: a `dist/<group>/pkg` folder containing a complete, self-consistent bundle (built code + one specific `package.json` manifest variant). The unit of **bytes**. The `dev` group plus one prod group per distinct byte-variant; a group is described by `BuildGroupSpec` (`{ id, name }`) so it carries its resolved manifest name.
- **Target** — a publish destination: a registry endpoint plus its publish config. A Target is bound to exactly one TargetGroup.

The relationship is **N Targets : 1 TargetGroup** — `dist/prod/npm` shipped to npm + GitHub Packages + a custom registry is three Targets, identical bytes. A second publishable TargetGroup exists *only* when a manifest change alters the bundled bytes (in practice a `name`/scope transform, which matters for release attestation). Both relationships are declared through `publishConfig.targets`: a `name`/string override creates a new byte-variant group, while a `from` target binds an extra registry endpoint to an existing group's bytes.

**The boundary:** the bundler **builds TargetGroups**. Targets (registry upload + attestation) are the release action's job, consuming the built `dist/{group}/pkg` folders. The bundler's responsibility ends at emitting a valid `pkg/` plus the binding that tells the release action which Targets map to which group.

## Multi-target publishing

The derivation (which groups, which registries, which validation) lives wholly in `@savvy-web/tsdown-plugins`' `resolveTargets` (see `../tsdown-plugins/architecture.md`); the bundler reads config and threads results.

- **`--target prod`** reads the Record-map `publishConfig.targets`, calls `deriveProdGroups` (a `run.ts` helper wrapping `resolveTargets`, defaulting to `{ npm: true }` when nothing is declared), builds every resolved group and writes `dist/prod/targets.json` via `writeTargetsBinding`. The single-target common case yields exactly one `npm` group named after the package.
- **`--target dev`** builds a single `dev` group named after the package and writes NO binding (dev is registry-less, local-link only).
- Every in-repo package declares the Record-map form (`{ npm: true, github: true }` or `{ npm: true }`). An array-valued `targets` reads as `undefined` and falls back to the single-`npm` default.

## Dist layout

```text
dist/
  dev/                  # the dev TargetGroup (registry-less, local-link only)
    pkg/                # ← pnpm linkDirectory points HERE; clean publishable bytes
    issues.json         # structured build diagnostics; read buildOk first; no meta pass
  prod/
    targets.json        # the TargetResolution binding for the release action
    issues.json         # structured build diagnostics, including the ae-*/tsdoc- meta pass
    npm/                # one folder per distinct byte-variant group; npm is the default
      pkg/              # the tarball root — transformed manifest + built code
      meta/             # meta bundle (release asset); the canonical group also copies into localPaths
      declarations/     # per-module unbundled dts tree (never published) — API Extractor input
    github/             # a second byte-variant, e.g. a rescoped @scope/name manifest
      pkg/
      meta/
      declarations/
```

- **`pkg/` *is* the tarball** — nothing to ignore. The pnpm link root is `dist/dev/pkg`, so linking never drags meta or buildinfo files.
- **Clean turbo caching:** `build:dev → dist/dev/**` and `build:prod → dist/prod/**` are disjoint cache lanes (root `turbo.json`; `packages/bundler/turbo.json` widens `build:prod` outputs to the website model sink its meta pass writes into).
- `deriveTargetGroupOptions` in `tsdown-plugins` (`src/build/target-groups.ts`) owns the `outDir` mapping: `dev → dist/dev/pkg`, prod group → `dist/prod/<group>/pkg`.

## The orchestrator to tsdown boundary

`runBuild` delegates the per-group build loop to `buildTargetGroups` (`tsdown-plugins/src/build/build-target-groups.ts`), which calls `tsdown.build()` with config-file loading bypassed and inline options. Per TargetGroup it runs a JS pass (per-module output) and a bundled-dts pass (one single-entry `build()` per entry, for byte-deterministic declarations), plus on prod a third per-module declarations pass into `dist/prod/<id>/declarations/` for API Extractor. The pass mechanics, the `unbundle`/`fixedExtension` choices, the manifest-emit plugin and the dts tsconfig all live in `../tsdown-plugins/architecture.md`; the bundler only chooses which knobs to forward (see [Build options](./build-options.md)).

The build loop is a **composable helper, not locked in the orchestrator**, so the escape hatch gets multi-group builds too.

## Catalog resolution and the process.cwd() constraint

For a prod manifest the bundler must resolve `catalog:`/`workspace:` specifiers to concrete ranges. It **delegates this entirely** to `resolveManifest` in `tsdown-plugins` (which in turn delegates to `@effected/workspaces`). The bundler owns no catalog-source logic.

The load-bearing constraint that flows from that delegation: the resolver discovers the workspace root from **`process.cwd()`**. The bundler satisfies this because `savvy.build.ts` self-executes in the package directory, and catalogs are workspace-wide, so any cwd inside the target workspace yields the same catalog set. Resolving a manifest for a workspace *other* than `process.cwd()`'s is out of scope.

## Boundaries and invariants

- **The bundler owns no build behavior.** Every behavior is a helper in `@savvy-web/tsdown-plugins`; the bundler only wires them and decides *when* and *where*. Anything the front door does, a hand-written build script can do by importing the same helper.
- **The bundler's responsibility ends at `dist/{group}/pkg` plus `dist/prod/targets.json`.** Registry upload and attestation are the release action's job. `resolveTargets` is the single source of truth for the derivation — the bundler never reimplements it.
- **Config validation runs first and is structural only.** `ConfigValidator.validate` gates every target path before any build branch.
- **The issues artifact is written on every terminal path, before the log renders, stamped with `buildOk`.** A crashed build never reads as a clean gate.
- **`tsdown`, `rolldown`, `@tsdown/exe` and `effect` are regular dependencies, never peers.** Consumers install one devDependency. `rolldown` is declared directly so the `Plugin` type stays an external reference in the bundler's own emitted `.d.ts` (see [Build options](./build-options.md)). Effect is v4 (`catalog:effect`) and is used only to run the `ConfigValidator` service and the report pipeline.
- **Self-hosting is complete.** Every in-repo package builds via this stack; the bundler and `tsdown-plugins` self-build through escape-hatch `savvy.build.ts` files. See [Self-hosting](./self-hosting.md).
- **Catalog resolution is delegated** and inherits the `process.cwd()` workspace-discovery constraint.

## Rationale

### Why a thin orchestrator

Putting every behavior in `tsdown-plugins` and keeping the bundler thin is what makes the escape hatch first-class: the front door and a hand-written build script are the same building blocks, so there is no privileged private surface to reverse-engineer. It also keeps the bundler's own surface tiny and injectable for tests.

### Why programmatic tsdown, not a peer

A maintained peer dependency on the underlying bundler drifts out of sync and causes install firefights across an ecosystem of repos. Depending on `tsdown` programmatically as a regular dependency makes a tsdown upgrade a single bundler release rather than a coordinated peer bump.

### Why delegate catalog resolution

A generic, well-tested resolver (`@effected/workspaces`) assembles catalogs durably from `pnpm-workspace.yaml`, config-dependency hook replay and the lockfile without depending on pnpm's transient state file, so the bundler delegates and owns no catalog-source logic. The cost is the `process.cwd()` constraint described above. Delegating through `tsdown-plugins` rather than depending on the resolver directly is what kept the Effect v4 migration a manifest-only change in this package.
