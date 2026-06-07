---
status: current
module: bundler
category: architecture
created: 2026-06-05
updated: 2026-06-07
last-synced: 2026-06-07
completeness: 90
related:
  - ../tsdown-plugins/architecture.md
  - ../cli/architecture.md
  - ../github-action-builder/architecture.md
dependencies:
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/bundler architecture

The all-in-one, tsdown-based replacement for `@savvy-web/rslib-builder`. A consumer installs one devDependency (`@savvy-web/bundler`), writes a self-executing `savvy.build.ts` and gets a pinned, tested tsdown transitively. This doc covers the SP1 foundation plus the M2 self-host, the M3 bundled-dts default and the M4–M6 finish: **all nine in-repo packages now build via the bundler and `@savvy-web/rslib-builder` + `@rslib/core` are decommissioned from `systems`**. The M4–M6 work added the bundling-posture knobs (`bundleNodeModules`, `bundledPackages`, `dtsExternals`) and the cjs-default-interop plugin that let the bundler reproduce every rslib posture cli/mcp/silk needed. Only Track E (full publishability) remains outstanding.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The two-package split](#the-two-package-split)
- [The savvy.build.ts contract](#the-savvybuildts-contract)
- [defineBuild and runBuild](#definebuild-and-runbuild)
- [TargetGroup and Target model](#targetgroup-and-target-model)
- [Multi-target publishing](#multi-target-publishing)
- [Dual-format esm plus cjs](#dual-format-esm-plus-cjs)
- [Bundling-posture knobs](#bundling-posture-knobs)
- [Self-hosting: the three-tier bootstrap ladder](#self-hosting-the-three-tier-bootstrap-ladder)
- [The shipped ecma.json tsconfig preset](#the-shipped-ecmajson-tsconfig-preset)
- [Dist layout](#dist-layout)
- [Meta generation wiring](#meta-generation-wiring)
- [JSX wiring](#jsx-wiring)
- [Exe compilation wiring](#exe-compilation-wiring)
- [The config-validation gate](#the-config-validation-gate)
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

SP1 implemented, plus the M2 self-host and the M3 bundled-dts default. The package exposes `defineBuild`/`runBuild` (`src/index.ts`) and **now builds itself** via an escape-hatch `savvy.build.ts` (it dropped the `@rslib/core` + `@savvy-web/rslib-builder` devDeps and the `rslib.config.ts`, added `tsx`). `tsdown` is a regular `dependency` (programmatic, transitively pinned for consumers); `@savvy-web/tsdown-plugins` is `workspace:*`. See [Self-hosting: the three-tier bootstrap ladder](#self-hosting-the-three-tier-bootstrap-ladder).

The SP1 exit gate is output parity building the real `@savvy-web/cli` end-to-end: bin compilation (`savvy`), dts over a large Effect codebase, `catalog:silk` + `workspace:*` resolution and the manifest transform, in one package.

Track A (API Extractor meta generation) also landed on top of SP1: `--target meta` generates an `.api.json` model into configured `localPaths`, and `--target npm` additionally emits a `meta/` release-asset bundle. All meta behavior lives in `@savvy-web/tsdown-plugins`' `src/meta/` (`generateMeta`); the bundler only wires it. See [Meta generation wiring](#meta-generation-wiring).

Track C (multi-target / renamed-package publishing) also landed: `--target npm` now derives ALL prod byte-variant groups from `publishConfig.targets` via `resolveTargets`, builds each, writes a `dist/prod/targets.json` binding and emits one report group per built group. The derivation lives entirely in `@savvy-web/tsdown-plugins`' `src/targets/`; the bundler only wires it. See [Multi-target publishing](#multi-target-publishing).

Tracks B (SEA executables), D (JSX/React) and a §8 config-validation gate also landed. `--target exe` compiles single-executable binaries over `@tsdown/exe`; JSX runtime is inherited from the package tsconfig (or an explicit `defineBuild({ jsx })` override) and threaded into both the dts tsconfig and the build; a `ConfigValidator` runs FIRST in `runBuild` to fast-fail on bad config across every target path. All the behavior lives in `@savvy-web/tsdown-plugins`; the bundler wires it. See [JSX wiring](#jsx-wiring), [Exe compilation wiring](#exe-compilation-wiring) and [The config-validation gate](#the-config-validation-gate).

M1 (dual-format esm plus cjs) also landed: `defineBuild({ format })` surfaces an optional `format?: ReadonlyArray<BuildFormat>` (`"esm" | "cjs"`, default `["esm"]`) that the bundler forwards into the build loop, and adding `"cjs"` produces a dual-format build (esm `.js` plus cjs `.cjs`, dual `import`/`require` export conditions, CJS interop). The default is esm-only so every existing build is byte-unchanged. This is the prerequisite for self-hosting `systems` onto the bundler; no package opts in yet. See [Dual-format esm plus cjs](#dual-format-esm-plus-cjs).

M2 (self-host), M3 (bundled dts) and the M4–M6 finish landed on top: the bundler, `tsdown-plugins` and all seven library/host packages now build via the bundler stack instead of rslib, the build emits a single rolled-up `.d.ts` per public entry by default, and M6 deleted rslib from `systems` entirely. M4 migrated `@savvy-web/cli`; M5 migrated `@savvy-web/mcp` (corpus relocated to `public/content`) and `@savvy-web/silk` (the hard case — dual-format, force-bundled runtime, see `../silk/architecture.md`); M6 removed `@savvy-web/rslib-builder`/`@rslib/core` and the dead `build:savvy` turbo tasks. See [Self-hosting: the bootstrap ladder](#self-hosting-the-three-tier-bootstrap-ladder), [Bundling-posture knobs](#bundling-posture-knobs) and (for the two-pass dts mechanics) `../tsdown-plugins/architecture.md`.

Explicitly out of SP1 (see the spec's decomposition): the `bundler check` preflight/validation model (SP2 — distinct from the §8 fast-fail gate, which checks structural config only) and virtual entries. Track C delivers the multi-byte-variant publishing originally scoped for SP4; M1 delivers dual-format. SP1 builds a `dev` TargetGroup; `--target npm` builds the single-`npm` default or, when a package declares the Record-map `publishConfig.targets`, every derived prod group. **Track E (full publishability) remains the one outstanding item.** Self-hosting is otherwise COMPLETE — `@savvy-web/rslib-builder` and `@rslib/core` no longer exist in `systems` (M6); every package builds via the bundler.

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
  format: ["esm", "cjs"],
  externals: ["typescript"],
  devManifest: "preserve",
  transform({ pkg, targetGroup }) { /* manifest surgery, per TargetGroup */ return pkg; },
});
```

- **No bin.** `package.json` scripts run the file directly: `"build:dev": "node savvy.build.ts --target dev"`, `"build:prod": "node savvy.build.ts --target npm"`.
- **Self-execution** is gated on `import.meta.main` at the *file* (so `run.ts` performs the gate with access to the caller's `import.meta`; `defineBuild` in `config.ts` stays pure). Imported by the silk plugin or the cli for introspection, it returns a side-effect-free config object. Run directly, it parses `process.argv` and builds.
- **Baseline arg surface:** `--target <dev|npm|meta|exe>` (default `dev`) and `--watch`. `meta` was added by Track A, `exe` by Track B; `--mode` and friends arrive with SP2. See `parseArgs` in `src/config.ts`.
- **Meta config:** an optional `meta?: MetaOptions` (re-exported from `@savvy-web/tsdown-plugins`) on the `defineBuild` input enables meta generation. `--target meta` requires it; `--target npm` emits a `meta/` bundle only when it is set.
- **Exe and JSX config:** `defineBuild` also takes optional `exe?: ExeConfig | ExeConfig[]` (one binary per entry, required by `--target exe`) and `jsx?: JsxConfig` (an explicit override; otherwise inferred from the package tsconfig). Both types are re-exported from `@savvy-web/tsdown-plugins`. See [Exe compilation wiring](#exe-compilation-wiring) and [JSX wiring](#jsx-wiring).
- **Node baseline:** native TS type-stripping (Node 24.11+). No tsx fallback.

`savvy.build.ts` replaces rslib's inscrutable factory-notation `rslib.config.ts`. It is agent-legible and a reliable signal the silk plugin can detect and introspect.

## defineBuild and runBuild

Two functions, deliberately separated so the config surface stays pure and the orchestration stays injectable.

- **`defineBuild(input)`** (`src/config.ts`) normalizes and validates the config (`externals`, `devManifest`, `transform`, `output`, the optional `meta`/`jsx`/`exe`/`format` plus the M4–M6 posture knobs `bundleNodeModules`/`bundledPackages`/`dtsExternals`) into a `BuildConfig`, applying defaults (`devManifest: "preserve"`). It does **not** itself run the build — see `src/config.ts` for the note on why the `import.meta.main` gate lives in `run.ts`. The optional `format?: ReadonlyArray<BuildFormat>` is the **live** dual-format field (M1). A pre-existing dead `formats: ReadonlyArray<"esm">` field still sits beside it but is not consumed by the build — `format` is the one `runBuild` reads.
- **`runBuild(config, options)`** (`src/run.ts`) is the orchestrator: parse argv → read `package.json` at cwd → resolve effective jsx (explicit override ?? `readTsconfigJsx` inference) → write the resolved dts tsconfig (`writeResolvedTsconfig`, with the jsx forwarded) → derive entries (`packageJsonEntries`) → **run `ConfigValidator.validate(...)` first to fast-fail bad config** → branch on `--target`: `meta` and `exe` short-circuit before the main build; otherwise derive the build groups (a single `dev` group, or all prod groups from `publishConfig.targets`) → call `buildTargetGroups` (jsx and `config.format` threaded in via conditional spread) → on `--target npm` write the `targets.json` binding → assemble a `BuildReport` (one entry per built group) and render it via `renderReport`/`ReportPipelineLive`. Every IO dependency (`buildTargetGroups`, `generateMeta`, `readExports`, `readPublishTargets`, `writeTargetsBinding`, `runExeBuild`, `readTsconfigJsx`, `readOsCpu`) is injectable on `RunOptions` so the orchestration is unit-testable without touching disk or spawning tsdown.

The `BuildReport` the bundler assembles in SP1 is intentionally minimal (per-TargetGroup `{ id, entries, timings, warnings, errors }`); SP2 extends it with `wouldFailProd[]` preflight findings. The report *schema* and *reporter pipeline* are owned by `tsdown-plugins`.

## TargetGroup and Target model

Two terms from the program glossary, load-bearing across the whole bundler design:

- **TargetGroup** — a single build output: a `dist/<group>/pkg` folder containing a complete, self-consistent bundle (built code + one specific `package.json` manifest variant). The unit of **bytes**. The `dev` group plus one prod group per distinct byte-variant; the `TargetGroupId` in `tsdown-plugins` is now any `string` (Track C widened it from `"dev" | "npm"`), and a group is described by `BuildGroupSpec` (`{ id, name }`) so it carries its resolved manifest name.
- **Target** — a publish destination: a registry endpoint plus its publish config. A Target is bound to exactly one TargetGroup (the bytes it ships).

The relationship is **N Targets : 1 TargetGroup** — `dist/prod/npm` shipped to npm + GitHub Packages + a custom registry is three Targets, identical bytes. You split into more than one publishable TargetGroup *only* when a manifest change alters the bundled bytes (in practice a `name`/scope transform, which matters for release attestation). Track C makes both relationships declarative through `publishConfig.targets`: a `name`/string override creates a new byte-variant group, while a `from` target binds an extra registry endpoint to an existing group's bytes. See [Multi-target publishing](#multi-target-publishing).

**The boundary:** the bundler **builds TargetGroups**. Targets (registry upload + attestation) are the release action's job, consuming the built `dist/{group}/pkg` folders. The bundler's responsibility ends at emitting a valid `pkg/` plus the binding that tells the release action which Targets map to which group.

## Multi-target publishing

Track C wires the bundler to `publishConfig.targets`. The derivation itself (which groups, which registries, which validation) lives wholly in `@savvy-web/tsdown-plugins`' `resolveTargets` (see `../tsdown-plugins/architecture.md`); the bundler reads config and threads results.

- **`--target npm`** reads `publishConfig.targets`, calls `deriveProdGroups` (a `run.ts` helper wrapping `resolveTargets`, defaulting to `{ npm: true }` when none is declared), builds every resolved group via `buildTargetGroups`, then `writeTargetsBinding(cwd, resolution)` writes `dist/prod/targets.json` and the report carries one group per built group. The single-target common case still yields exactly one `npm` group named after the package.
- **`--target dev`** builds a single `dev` group named after the base name and writes NO binding (dev is registry-less, local-link only). `--target meta` is unchanged.
- **The legacy-array guard is load-bearing.** `publishConfig.targets` already exists in every current in-repo package as the rslib-builder ARRAY form. The default reader treats an array-valued `targets` as `undefined` and falls back to the single-`npm` default, so existing packages' build behavior is unchanged and the new multi-target path stays **dormant** until a package migrates `publishConfig.targets` to the Record-map form. The two shapes collide on the same key by design; only the Record map activates Track C.

## Dual-format esm plus cjs

M1 makes the build's output formats configurable so a package can emit both esm and cjs (the rslib parity target for CJS consumers like `@savvy-web/silk`). As with every build behavior, the mechanics live in `@savvy-web/tsdown-plugins` (`format`/`dual`/`cjsDefault` threading, the manifest dual-condition transform, the `fixedExtension: false` finding — see `../tsdown-plugins/architecture.md`); the bundler only surfaces the knob and forwards it.

- **`defineBuild({ format })`** takes an optional `format?: ReadonlyArray<BuildFormat>` (`"esm" | "cjs"`, re-exported from `@savvy-web/tsdown-plugins`). `runBuild` forwards `config.format` into the `buildTargetGroups` call (conditional spread, mirroring `jsx`); `tsdown-plugins` defaults it to `["esm"]` when unset.
- **Dual-format is opt-in and dormant.** Adding `"cjs"` triggers esm `.js` plus cjs `.cjs` output, dual `import`/`require` export conditions in the emitted manifest, CJS named-export interop and a `.d.cts` declaration. With the default `["esm"]`, every existing build is byte-identical — no package opts in yet, so M1 is a capability, not a migration.
- **Why M1 exists:** it is the prerequisite for self-hosting `systems` onto the bundler. The first real `format: ["esm", "cjs"]` consumer is silk, in the separate M2–M6 self-host plan.
- A real end-to-end integration fixture (`__test__/integration/dual-format/`) proves a dual-format build emits both formats, dual conditions and a require-able cjs output.

## Bundling-posture knobs

M4–M6 added three `defineBuild` knobs so a package can pick any rslib bundling posture. As with every behavior, the mechanics live in `@savvy-web/tsdown-plugins` (the per-pass `deps` shapes, the dts-posture mirror — see [Bundling posture](../tsdown-plugins/architecture.md)); `runBuild` only conditional-spreads each onto the `buildTargetGroups` call. They were driven by the cli/mcp/silk migration: cli/mcp use `externals` only (their runtime deps stay external), while silk needs all three.

- **`bundleNodeModules?: boolean`** force-bundles every node_modules/workspace dep not in `externals` into the package output (rslib's bundle-everything-except-externals), and the dts pass inlines the matching types. Defaults off. silk's self-contained CJS-requireable artifact depends on it.
- **`bundledPackages?: ReadonlyArray<string>`** inlines ONLY the listed packages' declarations into the bundled dts (rslib `dtsBundledPackages` parity), externalizing the rest. JS-pass-unaffected.
- **`dtsExternals?: ReadonlyArray<string>`** externalizes the listed packages in the dts pass ONLY (emitted as `import` references), while the JS pass still bundles them per `bundleNodeModules`. For dependencies whose types cannot be inlined — silk lists `effect`/`@effect/platform` here because effect's `declare module` augmentations would inline into TS2320 conflicts in consumers.

An integration fixture per knob (`__test__/integration/bundle-node-modules`, `bundled-packages`) proves the JS/dts split. The cjs-default-interop footer (rslib `cjsInterop` parity) is not a knob — it activates automatically for any dual-format build; see `../tsdown-plugins/architecture.md`.

## Self-hosting: the three-tier bootstrap ladder

M2 retired rslib from the bundler stack and four leaf libraries; M4–M6 then migrated the last three packages and deleted rslib outright. The ladder resolves the chicken-and-egg of a builder building itself across three tiers:

- **Tier 1 — `@savvy-web/tsdown-plugins`** builds itself via an escape-hatch `savvy.build.ts` that imports `buildTargetGroups` from its **OWN `./src`** (`tsx` compiles the TS on the fly — no built copy exists yet). It cannot use `defineBuild`/`runBuild` because those live in the bundler, which is downstream.
- **Tier 2 — `@savvy-web/bundler`** builds itself via an escape-hatch `savvy.build.ts` that imports `buildTargetGroups` from the **already-built `@savvy-web/tsdown-plugins`** (the workspace link). It cannot use its own `defineBuild`/`runBuild` (that would need an already-built bundler).
- **Tier 3 — the seven downstream packages** (`templates`, `github-action-effects`, `silk-effects`, `github-action-builder`, plus the M4–M6 additions `cli`, `mcp` and `silk`) build via the normal **front-door** `defineBuild`/`runBuild`, because the bundler is built by the time they run.

Each migrated package: added `savvy.build.ts` + a `turbo.json` `$TURBO_EXTENDS$` override of `build:dev`/`build:prod`/`build:meta` outputs/inputs, swapped scripts to `node savvy.build.ts --target dev|npm|meta`, dropped `@savvy-web/rslib-builder` + `@rslib/core` and deleted `rslib.config.ts`. The two escape-hatch (tier 1/2) `savvy.build.ts` files port the exact externals and prod-strip transform from the old `rslib.config.ts`; they call `buildTargetGroups` with no `meta`, so API Extractor never runs in a self-build (the old rslib `_base` apiModel suppression is therefore not carried over — see the comment headers in each `savvy.build.ts`). The front-door tier-3 files use the corresponding `defineBuild` options.

The three M4–M6 migrations had package-specific concerns: `cli` switched its `publishConfig` to the `dist/dev/pkg` + `dist/prod/npm/pkg` layout and fixed the silk-effects dogfood bin path (`dist/dev/pkg/bin/savvy.js`); `mcp` relocated its corpus from `src/resources/content` to top-level `public/content` because the bundler copies only `public/` (loader probe paths, `tags.ts` and turbo follow the move); `silk` is the hard case — dual-format with a force-bundled runtime, documented in `../silk/architecture.md`. M6 also added a bundler `types:check → dependsOn ["^build:dev","build:dev"]` cold-ordering fix (its fixtures import the self-package's `dist`). Decoupled install→build ordering was verified cold: a frozen install succeeds with no build, then `pnpm build` resolves `catalog:silkPeers`.

## The shipped ecma.json tsconfig preset

Dropping the rslib devDep removes the `@savvy-web/rslib-builder/tsconfig/ecma/lib.json` base that all six packages extended, which would leave tsgo falling back to broken defaults. The bundler now ships its own base preset:

- **`packages/bundler/public/ecma.json`** is published via the top-level `public/` copy convention and exported as `"./ecma.json": "./public/ecma.json"`. Every migrated downstream package extends `@savvy-web/bundler/ecma.json` (package specifier).
- **The bundler extends its OWN copy by relative path** (`./public/ecma.json`) rather than the package specifier, to avoid a build-before-typecheck cycle (the package specifier resolves only after the `public/` copy lands in `dist`).
- **`@savvy-web/tsdown-plugins` is upstream of the bundler**, so it cannot consume the package specifier. It keeps a byte-identical **synced local copy** at `packages/tsdown-plugins/ecma.json` (extends `./ecma.json`), guarded by `__test__/ecma-sync.test.ts` which fails if the two files drift.

## Dist layout

```text
dist/
  dev/                  # the dev TargetGroup (registry-less, local-link only)
    pkg/                # ← pnpm linkDirectory points HERE; clean publishable bytes
    meta/              # (Track A) staging outMetaDir for --target meta before copy into localPaths
  prod/
    targets.json        # (Track C) the TargetResolution binding for the release action
    npm/                # one folder per distinct byte-variant group (Track C); npm is the single-target default
      pkg/              # the tarball root — transformed manifest + built code
      meta/            # (Track A) meta bundle (release assets) into the canonical group only, when config.meta is set
    github/             # (Track C) a second byte-variant — e.g. a rescoped @scope/name manifest
      pkg/
```

- **`pkg/` *is* the tarball** — nothing to ignore. This retires rslib's "mix meta files into `dist/npm` and exclude them via package.json ignore patterns" hack.
- The pnpm link root is **`dist/dev/pkg`** (linking never drags meta/buildinfo files). These are new packages so there is no migration cost.
- **Clean turbo caching:** `build:dev → dist/dev/**`, `build:prod → dist/prod/**` are disjoint cache lanes.
- Local linking itself is the existing pnpm `linkDirectory` + injection mechanism — the bundler does not touch it.

`deriveTargetGroupOptions` in `tsdown-plugins` (`src/build/target-groups.ts`) owns the `outDir` mapping: `dev → dist/dev/pkg`, prod group → `dist/prod/<group>/pkg`.

## Meta generation wiring

Track A adds API Extractor meta generation. The bundler is pure wiring over `generateMeta` from `@savvy-web/tsdown-plugins` (all the behavior lives there — see `../tsdown-plugins/architecture.md`); the bundler decides *when* and *where*.

- **`--target meta`** runs `generateMeta` over the already-built `dist/dev/pkg` dts (API Extractor over the emitted dev `.d.ts`; there is **no** tsdown build), stages the bundle in `dist/dev/meta` and copies the resulting api-model into the `localPaths` configured in `config.meta`. This is why the `build:meta` turbo task depends only on `build:dev`. It throws if `config.meta` is unset.
- **`--target npm`** additionally emits a `meta/` release-asset bundle (empty `localPaths`) when `config.meta` is set — so meta ships as a publish asset, not mixed into `pkg/`. With Track C's multiple prod groups, meta is emitted **once into the canonical group's dir** — the group whose resolved name matches the package name, else the first group (`dist/prod/<canonicalId>/meta`). Per-variant meta is out of scope; renamed variants share the canonical group's api-model.
- **Decoupling:** meta is split from the prod build on purpose. `build:prod` emits the `meta/` asset; `savvy build --target meta` emits the api-model into other packages' `localPaths` and depends only on `build:dev`. Neither path re-runs the bundle.
- **`deriveExportPaths`** (a `run.ts` helper) recovers export keys from the package `exports` map to drive the per-entry extraction. `generateMeta`/`readExports` are injectable on `RunOptions` so the wiring stays unit-testable.

**Known limitation:** `deriveExportPaths` handles only plain string exports. *Conditional* exports (object-valued entries) and nested subpaths like `./foo/bar` fall through to a heuristic. Every current Silk package uses plain string exports, so nothing triggers it today, but a package with conditional exports would need this hardened first.

### The build:meta turbo task

`turbo.json` defines `build:meta` with `dependsOn: ["build:dev"]`, `cache: false`, `outputs: []`. It is **intentionally uncached** because it writes into *other* packages' `localPaths` — outputs outside its own cache scope — so turbo cannot track or restore them correctly. See `README.md` for the consumer-facing description.

## JSX wiring

Track D lets a `.tsx` package build with the right JSX runtime with zero extra config. The mapping itself (`resolveJsxConfig`/`readTsconfigJsx`) lives in `@savvy-web/tsdown-plugins`' `src/jsx/`; the bundler resolves the *effective* config once and threads it.

- **Resolution order:** `runBuild` computes `resolveJsxConfig(readTsconfigJsx(cwd), config.jsx)` — an explicit `defineBuild({ jsx })` override wins, else the runtime is inferred from the package's own `tsconfig.json` `compilerOptions.jsx` (`react-jsx`/`react-jsxdev` → automatic with importSource default `"react"`, `react` → classic, `preserve`/none → undefined).
- **Two consumers, one resolution:** the resolved `jsx` flows both into the dts tsconfig (`writeResolvedTsconfig({ jsx, jsxImportSource })`, so declaration emit over `.tsx` sees the same runtime) and into the `buildTargetGroups` call (`inputOptions.jsx`). The real `.tsx` integration fixture asserts the automatic runtime (a `react/jsx-runtime` import, no `React.createElement`).

## Exe compilation wiring

Track B adds `--target exe` for packages that ship a single-executable (SEA) binary. All the behavior lives in `@savvy-web/tsdown-plugins`' `src/exe/` (`normalizeExeOptions`/`runExeBuild`); the bundler wires the branch.

- **The branch** sits after the meta short-circuit, before the main library build. It normalizes `config.exe` via `normalizeExeOptions` (passing the package `os`/`cpu`, both injectable as `readOsCpu`) and delegates to the injectable `runExeBuild`, emitting binaries into `dist/dev/pkg/bin`. It throws if no `exe` is configured.
- **`@tsdown/exe ^0.22.1` is a RUNTIME dependency of the bundler** (not of tsdown-plugins) — tsdown lazily `importWithError`s it only when the exe option is used. This keeps tsdown-plugins interface-only while letting the bundler ship the SEA toolchain.
- Real binary compilation is a CI/mac-runner manual step, out of the hermetic test suite; the in-repo tests inject a fake `runExeBuild` and assert the wiring.

## The config-validation gate

§8 added a fast-fail validator that runs FIRST in `runBuild`, after the publishTargets/exports facts are computed but before any build branch, so a structurally-bad config fails immediately across the dev/npm/meta/exe paths rather than partway through a build. The rule set lives in `@savvy-web/tsdown-plugins`' `ConfigValidator`/`ConfigValidatorLive` (see `../tsdown-plugins/architecture.md`); the bundler assembles the `ValidationInput` (baseName, `hasExports`, and the optional `targets`/`exe`/`osCpu`/`meta`) and runs `ConfigValidator.validate(...)` via `Effect.runPromise` over `ConfigValidatorLive`. A failure surfaces as a typed `ConfigValidationError`. This is **not** the SP2 `bundler check` preflight model — it validates structural config shape only, not prod-build viability.

## The orchestrator to tsdown boundary

`runBuild` delegates the per-group build loop to `buildTargetGroups` (`tsdown-plugins/src/build/build-target-groups.ts`), which calls `tsdown.build()` with config-file loading bypassed (`config: false`) and inline options derived from `deriveTargetGroupOptions`. M3 made this **two tsdown passes per TargetGroup** to the same outDir — a JS pass (`unbundle: true`, `dts: false`) and a bundled-dts pass (`unbundle: false`, `dts: { emitDtsOnly: true }`, `clean: false`) — so the build emits per-module JS plus a single rolled-up `.d.ts` per public entry. The two-pass mechanics and rationale live in `../tsdown-plugins/architecture.md`. SP1 fixed choices that cross this boundary:

- `unbundle: true` (rolldown `preserveModules`) on the JS pass replaces rslib's `disableSharedChunks` — one-to-one source→output, no shared cross-entry runtime chunk, which sidesteps the multi-entry ESM `__webpack_require__` collision rslib worked around. The dts pass uses `unbundle: false` so declarations roll up.
- `fixedExtension: false` overrides tsdown's node-platform default so output uses the package-`type`-ambient extension (`.js`/`.d.ts` for `"type": "module"`). It stays `false` even for dual-format: tsdown 0.22.2 emits esm `.js` plus cjs `.cjs` with no collision under that setting, while `fixedExtension: true` would wrongly yield `.mjs`. See the empirical finding in `../tsdown-plugins/architecture.md`.
- bin shebang/`chmod` is tsdown's native `ShebangPlugin` — the bundler only handles bin→entry naming and the manifest `bin` rewrite, not the executable bit.

The build loop is a **composable helper, not locked in the orchestrator**, so the escape hatch gets multi-group builds too. See `../tsdown-plugins/architecture.md` for the manifest-emit plugin, the dts tsconfig and the rest of what crosses into tsdown.

## Catalog resolution and the process.cwd() constraint

For a prod manifest the bundler must resolve `catalog:`/`workspace:` specifiers to concrete ranges. SP1 **delegates this entirely** to `workspaces-effect`'s `CatalogResolver` (via `resolveManifest` in `tsdown-plugins`) — the key revision from the original plan, which had planned a silk-specific durable catalog asset. The bundler owns no catalog-source logic.

The load-bearing constraint that flows from that delegation: `CatalogResolver` has no cwd parameter — it discovers the workspace root from **`process.cwd()`**. The bundler satisfies this because `savvy.build.ts` self-executes in the package directory (`node savvy.build.ts` runs with cwd = the package), and catalogs are workspace-wide, so any cwd inside the target workspace yields the same catalog set. Resolving a manifest for a workspace *other* than `process.cwd()`'s is out of SP1 scope. This is also the fix for the long-standing `catalog:silkPeers`/state-file ordering bug: `CatalogResolver` assembles catalogs durably (inline `pnpm-workspace.yaml` + config-dependency hook-replay + lockfile) without depending on the transient `.pnpm-workspace-state-v1.json`. See the delegation detail in `../tsdown-plugins/architecture.md`.

## Boundaries and Invariants

- **The bundler owns no build behavior.** Every behavior is a helper in `@savvy-web/tsdown-plugins`; the bundler only wires them. Anything the front door does, a hand-written `tsdown.config.ts` can do by importing the same helper. This includes meta: `generateMeta` lives in tsdown-plugins; the bundler only decides when (`--target meta`/`--target npm`) and where (`localPaths`/`dist/prod/npm/meta`).
- **Meta is decoupled from the bundle.** Neither `--target meta` nor the npm meta-asset path re-runs the tsdown build — they run API Extractor over the already-emitted dev `.d.ts`. `build:meta` is uncached and depends only on `build:dev`.
- **The bundler's responsibility ends at `dist/{group}/pkg` plus `dist/prod/targets.json`.** Registry upload + attestation (Targets) are the release action's job; it consumes the binding to learn which built group each Target deploys. `resolveTargets` is the single source of truth for the derivation — the bundler never reimplements it.
- **The legacy-array `publishConfig.targets` path stays dormant.** Only the Record-map form activates Track C; an array-valued `targets` (the current rslib-builder shape) falls back to the single-`npm` default, leaving existing packages' bytes unchanged.
- **Dual-format is opt-in and dormant.** `format` defaults to esm-only, so the M1 capability adds nothing to a build until a package passes `format: ["esm", "cjs"]`. The bundler surfaces `defineBuild({ format })` and forwards it; the actual format/interop/manifest behavior is `tsdown-plugins`'.
- **Config validation runs first.** `ConfigValidator.validate` gates every target path; the rules live in tsdown-plugins (`resolveTargets`, the exe/meta checks) and the bundler only assembles the `ValidationInput`. It is structural-shape validation, distinct from the SP2 `bundler check` preflight.
- **`tsdown` is a regular dependency, not a peer.** Consumers never carry `tsdown`/`@rslib/core` in their own dependency tree — they install one devDependency. `@tsdown/exe` is a bundler runtime dependency (lazily imported by tsdown for `--target exe`), again not a peer.
- **Self-hosting is complete (M2–M6).** Every in-repo package builds via the bundler stack; `@savvy-web/rslib-builder` and `@rslib/core` are decommissioned from `systems` (M6). **Track E (full publishability) is the remaining outstanding work.** The two upstream packages (`tsdown-plugins`, `bundler`) self-build through escape-hatch `savvy.build.ts` files; everything else uses the front door — see [Self-hosting: the three-tier bootstrap ladder](#self-hosting-the-three-tier-bootstrap-ladder).
- **The bundling-posture knobs are pure wiring.** `bundleNodeModules`/`bundledPackages`/`dtsExternals` are conditional-spread onto `buildTargetGroups`; the dts-posture mirror and the cjs-default-interop plugin live in tsdown-plugins. See [Bundling-posture knobs](#bundling-posture-knobs).

## Rationale

### Why a thin orchestrator

Putting every behavior in `tsdown-plugins` and keeping the bundler thin is what makes the escape hatch first-class: the front door and a hand-written `tsdown.config.ts` are the same building blocks, so there is no privileged private surface that the escape hatch must reverse-engineer. It also keeps the bundler's own surface (`defineBuild`/`runBuild`) tiny and injectable for tests.

### Why programmatic tsdown, not a peer

rslib-builder's maintained `@rslib/core` peerDependency drifted out of sync and caused real install firefights. Depending on `tsdown` programmatically as a regular dependency makes a tsdown upgrade a single bundler release rather than a coordinated peer bump across ~33 repos.

### Why delegate catalog resolution

The original plan had the bundler ship a silk-specific durable catalog asset to fix the state-file ordering bug. `workspaces-effect@^1.2.0` shipped a generic `CatalogResolver` that solves the same problem durably and generically, so the bundler delegates and owns no catalog-source logic — removing a whole milestone of cross-repo `pnpm-plugin-silk` work. The cost is the `process.cwd()` workspace-discovery constraint described above.
