---
status: current
module: bundler
category: architecture
created: 2026-06-05
updated: 2026-06-05
last-synced: 2026-06-05
completeness: 85
related:
  - ../tsdown-plugins/architecture.md
  - ../cli/architecture.md
  - ../github-action-builder/architecture.md
dependencies:
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/bundler architecture

The all-in-one, tsdown-based replacement for `@savvy-web/rslib-builder`. A consumer installs one devDependency (`@savvy-web/bundler`), writes a self-executing `savvy.build.ts` and gets a pinned, tested tsdown transitively. This doc covers the SP1 foundation; `@savvy-web/rslib-builder` is unchanged and still builds the ecosystem (including these two packages) until the stack self-hosts.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The two-package split](#the-two-package-split)
- [The savvy.build.ts contract](#the-savvybuildts-contract)
- [defineBuild and runBuild](#definebuild-and-runbuild)
- [TargetGroup and Target model](#targetgroup-and-target-model)
- [Dist layout](#dist-layout)
- [Meta generation wiring](#meta-generation-wiring)
- [The orchestrator to tsdown boundary](#the-orchestrator-to-tsdown-boundary)
- [Catalog resolution and the process.cwd() constraint](#catalog-resolution-and-the-processcwd-constraint)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/bundler` is a thin orchestrator. It reads a package's `package.json` and its `savvy.build.ts`, derives per-TargetGroup tsdown options and drives tsdown's programmatic `build()` once per group. Every build behavior — entry detection, manifest emission, catalog resolution, the dts tsconfig port, the per-group loop, the output reporter — lives in `@savvy-web/tsdown-plugins`. The bundler imports those helpers and wires them; it owns no build logic of its own beyond the `savvy.build.ts` contract, arg parsing and report assembly.

**Package:** `@savvy-web/bundler`
**Location:** `packages/bundler` in `savvy-web/systems`
**Source:** `src/config.ts` (the `defineBuild` contract), `src/run.ts` (the `runBuild` orchestrator), `src/index.ts` (public surface)
**Versioning:** independent; changesets auto-bumps it when `@savvy-web/tsdown-plugins` changes, but it ships on its own. Not a fixed group.
**Status:** Silk bundler program sub-project 1 (SP1, Foundation). The approved spec and plan (local/gitignored) are `docs/superpowers/specs/2026-06-04-savvy-bundler-sp1-foundation-design.md` and `docs/superpowers/plans/2026-06-04-savvy-bundler-sp1.md`.

## Current State

SP1 implemented. The package exposes `defineBuild`/`runBuild` (`src/index.ts`) and is itself built by `@savvy-web/rslib-builder` (it carries `@rslib/core` + `@savvy-web/rslib-builder` devDeps and an `rslib.config.ts`) until the stack self-hosts in a later sub-project. `tsdown` is a regular `dependency` (programmatic, transitively pinned for consumers); `@savvy-web/tsdown-plugins` is `workspace:*`.

The SP1 exit gate is output parity building the real `@savvy-web/cli` end-to-end: bin compilation (`savvy`), dts over a large Effect codebase, `catalog:silk` + `workspace:*` resolution and the manifest transform, in one package.

Track A (API Extractor meta generation) also landed on top of SP1: `--target meta` generates an `.api.json` model into configured `localPaths`, and `--target npm` additionally emits a `meta/` release-asset bundle. All meta behavior lives in `@savvy-web/tsdown-plugins`' `src/meta/` (`generateMeta`); the bundler only wires it. See [Meta generation wiring](#meta-generation-wiring).

Explicitly out of SP1 (see the spec's decomposition): the `bundler check` preflight/validation model (SP2), renamed-package multi-byte-variant publishing (SP4), dual-format esm+cjs, and virtual entries. SP1 builds a `dev` TargetGroup plus a single `npm` prod TargetGroup.

## The two-package split

The program is two packages, split on an interface boundary:

- **`@savvy-web/tsdown-plugins`** — the plugin pack. Interface-only coupling to tsdown (authored against rolldown's `Plugin` *type*; no tsdown runtime import, no tsdown peer dependency). Holds all the build behaviors as composable helpers/plugins. See `../tsdown-plugins/architecture.md`.
- **`@savvy-web/bundler`** — this package. Depends on `tsdown-plugins` and `tsdown` as regular `dependencies`, drives tsdown's `build()` API, configured by `savvy.build.ts`.

The split buys two things. First, **no peer-sync trap**: the common-path consumer installs one devDependency and a tsdown upgrade becomes a bundler release, not an ecosystem-wide peer bump — the precise pain that triggered this program (rslib-builder's drifting `@rslib/core` peer). Second, a **real published escape hatch**: a power user brings their own `tsdown` + `@savvy-web/tsdown-plugins` and composes the same plugins in a hand-written `tsdown.config.ts`. The orchestrator is not a privileged path — anything it does (including the multi-group loop) is exposed as a helper. See the escape-hatch contract in `../tsdown-plugins/architecture.md`.

## The savvy.build.ts contract

A package configures the bundler with a `savvy.build.ts` that is **both declarative and runnable**:

```ts
import { defineBuild } from "@savvy-web/bundler";

export default defineBuild({
  formats: ["esm"],
  externals: ["typescript"],
  devManifest: "preserve",
  transform({ pkg, targetGroup }) { /* manifest surgery, per TargetGroup */ return pkg; },
});
```

- **No bin.** `package.json` scripts run the file directly: `"build:dev": "node savvy.build.ts --target dev"`, `"build:prod": "node savvy.build.ts --target npm"`.
- **Self-execution** is gated on `import.meta.main` at the *file* (so `run.ts` performs the gate with access to the caller's `import.meta`; `defineBuild` in `config.ts` stays pure). Imported by the silk plugin or the cli for introspection, it returns a side-effect-free config object. Run directly, it parses `process.argv` and builds.
- **Baseline arg surface:** `--target <dev|npm|meta>` (default `dev`) and `--watch`. `meta` was added by Track A; `--mode` and friends arrive with SP2. See `parseArgs` in `src/config.ts`.
- **Meta config:** an optional `meta?: MetaOptions` (re-exported from `@savvy-web/tsdown-plugins`) on the `defineBuild` input enables meta generation. `--target meta` requires it; `--target npm` emits a `meta/` bundle only when it is set.
- **Node baseline:** native TS type-stripping (Node 24.11+). No tsx fallback.

`savvy.build.ts` replaces rslib's inscrutable factory-notation `rslib.config.ts`. It is agent-legible and a reliable signal the silk plugin can detect and introspect.

## defineBuild and runBuild

Two functions, deliberately separated so the config surface stays pure and the orchestration stays injectable.

- **`defineBuild(input)`** (`src/config.ts`) normalizes and validates the config (`formats`, `externals`, `devManifest`, `transform`, `output`) into a `BuildConfig`, applying defaults (`formats: ["esm"]`, `devManifest: "preserve"`). It does **not** itself run the build — see `src/config.ts` for the note on why the `import.meta.main` gate lives in `run.ts`.
- **`runBuild(config, options)`** (`src/run.ts`) is the orchestrator: parse argv → read `package.json` at cwd → write the resolved dts tsconfig (`writeResolvedTsconfig`) → derive entries (`packageJsonEntries`) → call `buildTargetGroups` for the selected group → assemble a `BuildReport` and render it via `renderReport`/`ReportPipelineLive`. Every IO dependency (`buildTargetGroups`, `writeOutput`, `readVersion`, `readPackageName`) is injectable on `RunOptions` so the orchestration is unit-testable without touching disk or spawning tsdown.

The `BuildReport` the bundler assembles in SP1 is intentionally minimal (per-TargetGroup `{ id, entries, timings, warnings, errors }`); SP2 extends it with `wouldFailProd[]` preflight findings. The report *schema* and *reporter pipeline* are owned by `tsdown-plugins`.

## TargetGroup and Target model

Two terms from the program glossary, load-bearing across the whole bundler design:

- **TargetGroup** — a single build output: a `dist/<group>/pkg` folder containing a complete, self-consistent bundle (built code + one specific `package.json` manifest variant). The unit of **bytes**. SP1 groups are `dev` and `npm`; the `TargetGroupId` union in `tsdown-plugins` is `"dev" | "npm"`.
- **Target** — a publish destination: a registry endpoint plus its publish config. A Target is bound to exactly one TargetGroup (the bytes it ships).

The relationship is **N Targets : 1 TargetGroup** — `dist/npm` shipped to npm + GitHub Packages + a custom registry is three Targets, identical bytes. You split into more than one publishable TargetGroup *only* when a manifest change alters the bundled bytes (in practice a `name`/scope transform, which matters for release attestation) — that is the SP4 multi-byte-variant case, out of SP1.

**The boundary:** the bundler **builds TargetGroups**. Targets (registry upload + attestation) are the release action's job, consuming the built `dist/{group}/pkg` folders. The bundler's responsibility ends at emitting a valid `pkg/`.

## Dist layout

```text
dist/
  dev/                  # the dev TargetGroup (registry-less, local-link only)
    pkg/                # ← pnpm linkDirectory points HERE; clean publishable bytes
    meta/              # (Track A) staging outMetaDir for --target meta before copy into localPaths
  prod/
    npm/                # SP1: just npm. SP4: one folder per distinct byte-variant
      pkg/              # the tarball root — transformed manifest + built code
      meta/            # (Track A) meta bundle (release assets) when config.meta is set
```

- **`pkg/` *is* the tarball** — nothing to ignore. This retires rslib's "mix meta files into `dist/npm` and exclude them via package.json ignore patterns" hack.
- The pnpm link root is **`dist/dev/pkg`** (linking never drags meta/buildinfo files). These are new packages so there is no migration cost.
- **Clean turbo caching:** `build:dev → dist/dev/**`, `build:prod → dist/prod/**` are disjoint cache lanes.
- Local linking itself is the existing pnpm `linkDirectory` + injection mechanism — the bundler does not touch it.

`deriveTargetGroupOptions` in `tsdown-plugins` (`src/build/target-groups.ts`) owns the `outDir` mapping: `dev → dist/dev/pkg`, prod group → `dist/prod/<group>/pkg`.

## Meta generation wiring

Track A adds API Extractor meta generation. The bundler is pure wiring over `generateMeta` from `@savvy-web/tsdown-plugins` (all the behavior lives there — see `../tsdown-plugins/architecture.md`); the bundler decides *when* and *where*.

- **`--target meta`** runs `generateMeta` over the already-built `dist/dev/pkg` dts (API Extractor over the emitted dev `.d.ts`; there is **no** tsdown build), stages the bundle in `dist/dev/meta` and copies the resulting api-model into the `localPaths` configured in `config.meta`. This is why the `build:meta` turbo task depends only on `build:dev`. It throws if `config.meta` is unset.
- **`--target npm`** additionally emits a `meta/` release-asset bundle into `dist/prod/npm/meta` (the folder reserved in the dist layout, empty `localPaths`) when `config.meta` is set — so meta ships as a publish asset, not mixed into `pkg/`.
- **Decoupling:** meta is split from the prod build on purpose. `build:prod` emits the `meta/` asset; `savvy build --target meta` emits the api-model into other packages' `localPaths` and depends only on `build:dev`. Neither path re-runs the bundle.
- **`deriveExportPaths`** (a `run.ts` helper) recovers export keys from the package `exports` map to drive the per-entry extraction. `generateMeta`/`readExports` are injectable on `RunOptions` so the wiring stays unit-testable.

**Known limitation:** `deriveExportPaths` handles only plain string exports. *Conditional* exports (object-valued entries) and nested subpaths like `./foo/bar` fall through to a heuristic. Every current Silk package uses plain string exports, so nothing triggers it today, but a package with conditional exports would need this hardened first.

### The build:meta turbo task

`turbo.json` defines `build:meta` with `dependsOn: ["build:dev"]`, `cache: false`, `outputs: []`. It is **intentionally uncached** because it writes into *other* packages' `localPaths` — outputs outside its own cache scope — so turbo cannot track or restore them correctly. See `README.md` for the consumer-facing description.

## The orchestrator to tsdown boundary

`runBuild` delegates the per-group build loop to `buildTargetGroups` (`tsdown-plugins/src/build/build-target-groups.ts`), which calls `tsdown.build()` once per TargetGroup with config-file loading bypassed (`config: false`) and inline options derived from `deriveTargetGroupOptions`. SP1 fixed choices that cross this boundary:

- `unbundle: true` (rolldown `preserveModules`) replaces rslib's `disableSharedChunks` — one-to-one source→output, no shared cross-entry runtime chunk, which sidesteps the multi-entry ESM `__webpack_require__` collision rslib worked around.
- `fixedExtension: false` overrides tsdown's node-platform default (`.mjs`/`.cjs`) so output uses the package-`type`-ambient extension (`.js`/`.d.ts` for `"type": "module"`).
- bin shebang/`chmod` is tsdown's native `ShebangPlugin` — the bundler only handles bin→entry naming and the manifest `bin` rewrite, not the executable bit.

The build loop is a **composable helper, not locked in the orchestrator**, so the escape hatch gets multi-group builds too. See `../tsdown-plugins/architecture.md` for the manifest-emit plugin, the dts tsconfig and the rest of what crosses into tsdown.

## Catalog resolution and the process.cwd() constraint

For a prod manifest the bundler must resolve `catalog:`/`workspace:` specifiers to concrete ranges. SP1 **delegates this entirely** to `workspaces-effect`'s `CatalogResolver` (via `resolveManifest` in `tsdown-plugins`) — the key revision from the original plan, which had planned a silk-specific durable catalog asset. The bundler owns no catalog-source logic.

The load-bearing constraint that flows from that delegation: `CatalogResolver` has no cwd parameter — it discovers the workspace root from **`process.cwd()`**. The bundler satisfies this because `savvy.build.ts` self-executes in the package directory (`node savvy.build.ts` runs with cwd = the package), and catalogs are workspace-wide, so any cwd inside the target workspace yields the same catalog set. Resolving a manifest for a workspace *other* than `process.cwd()`'s is out of SP1 scope. This is also the fix for the long-standing `catalog:silkPeers`/state-file ordering bug: `CatalogResolver` assembles catalogs durably (inline `pnpm-workspace.yaml` + config-dependency hook-replay + lockfile) without depending on the transient `.pnpm-workspace-state-v1.json`. See the delegation detail in `../tsdown-plugins/architecture.md`.

## Boundaries and Invariants

- **The bundler owns no build behavior.** Every behavior is a helper in `@savvy-web/tsdown-plugins`; the bundler only wires them. Anything the front door does, a hand-written `tsdown.config.ts` can do by importing the same helper. This includes meta: `generateMeta` lives in tsdown-plugins; the bundler only decides when (`--target meta`/`--target npm`) and where (`localPaths`/`dist/prod/npm/meta`).
- **Meta is decoupled from the bundle.** Neither `--target meta` nor the npm meta-asset path re-runs the tsdown build — they run API Extractor over the already-emitted dev `.d.ts`. `build:meta` is uncached and depends only on `build:dev`.
- **The bundler's responsibility ends at `dist/{group}/pkg`.** Registry upload + attestation (Targets) are the release action's job.
- **`tsdown` is a regular dependency, not a peer.** Consumers never carry `tsdown`/`@rslib/core` in their own dependency tree — they install one devDependency.
- **Built by rslib-builder until self-host.** Both packages keep `@savvy-web/rslib-builder` + `@rslib/core` devDeps and an `rslib.config.ts` for now; dogfooding/self-hosting is a deliberate post-SP1 step.

## Rationale

### Why a thin orchestrator

Putting every behavior in `tsdown-plugins` and keeping the bundler thin is what makes the escape hatch first-class: the front door and a hand-written `tsdown.config.ts` are the same building blocks, so there is no privileged private surface that the escape hatch must reverse-engineer. It also keeps the bundler's own surface (`defineBuild`/`runBuild`) tiny and injectable for tests.

### Why programmatic tsdown, not a peer

rslib-builder's maintained `@rslib/core` peerDependency drifted out of sync and caused real install firefights. Depending on `tsdown` programmatically as a regular dependency makes a tsdown upgrade a single bundler release rather than a coordinated peer bump across ~33 repos.

### Why delegate catalog resolution

The original plan had the bundler ship a silk-specific durable catalog asset to fix the state-file ordering bug. `workspaces-effect@^1.2.0` shipped a generic `CatalogResolver` that solves the same problem durably and generically, so the bundler delegates and owns no catalog-source logic — removing a whole milestone of cross-repo `pnpm-plugin-silk` work. The cost is the `process.cwd()` workspace-discovery constraint described above.
