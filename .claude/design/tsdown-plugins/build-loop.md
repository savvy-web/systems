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
  - ./dts-emission.md
  - ./dual-format.md
  - ./report.md
  - ../bundler/architecture.md
  - ../rspress-builder/architecture.md
  - ../silk/architecture.md
---

# The build loop

`buildTargetGroups` (`src/build/build-target-groups.ts`) is the composable multi-group build loop the bundler's front door and both self-hosting escape hatches drive. This doc covers its pass structure, entry partitions, loose files, bundling posture, the `define` map and the `public/` sync. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The passes](#the-passes)
- [Partitions and per-entry overrides](#partitions-and-per-entry-overrides)
- [Web-runtime partitions](#web-runtime-partitions)
- [Loose files](#loose-files)
- [Bundling posture](#bundling-posture)
- [The define map](#the-define-map)
- [The public/ sync](#the-public-sync)
- [Minify default](#minify-default)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

Each TargetGroup builds into its own outDir (`dev → dist/dev/pkg`, prod → `dist/prod/<id>/pkg`, via `outDirFor`). Per group the loop runs a partition loop (the base entries plus any `overrides`), and per partition a JS pass, a bundled dts pass and — prod-only, opt-in — a per-module declarations pass, all layered into the same outDir. After the partitions, each loose file runs as one extra pass, then `copyPublicDir` and `copyAmbientDts` run once for the group. The loop input is `ReadonlyArray<BuildGroupSpec>` (`{ id, name }`), so each group carries its own resolved manifest name for the declarative rename.

The pure option derivations live in `src/build/target-groups.ts` — `deriveTargetGroupOptions` (JS pass), `deriveDtsPassOptions` (dts pass), `deriveDeclarationsPassOptions` (declarations pass) — whose TSDoc holds the empirical findings behind each option. `tsdown.build` is injectable on the options, the only place tsdown's runtime is touched.

## Current state

- **Loop and options:** `buildTargetGroups`, `BuildTargetGroupsOptions`, `EntryOverride`, `CssOptions` (`src/build/build-target-groups.ts`).
- **Derivations:** `deriveTargetGroupOptions`/`deriveDtsPassOptions`/`deriveDeclarationsPassOptions`, `outDirFor`/`declarationsDirFor`, the `BuildFormat`/`BuildPlatform`/`BuildGroupSpec` types (`src/build/target-groups.ts`).
- **Loose files:** `normalizeLooseFiles` and its types (`src/build/loose-files.ts`).
- **Public sync:** `copyPublicDir`/`copyAmbientDts` (`src/build/sync-public.ts`).

## The passes

- **JS pass** (`deriveTargetGroupOptions`): per-module JS — `unbundle: true` (rolldown `preserveModules`), `dts: false`, `clean: true` on the base partition only, `format` (default `["esm"]`), `platform` (default `"node"`), `fixedExtension: false`, dev lenient / prod minify-by-option, the `define` map. It is the only pass wired to the `emitManifest` plugin, so the manifest is emitted once per group.
- **dts pass** (`deriveDtsPassOptions`): bundled declarations only — `unbundle: false`, `clean: false` (load-bearing: it must not wipe the JS pass output), `dts: { tsconfig, emitDtsOnly: true, generator: "tsc" }`, no sourcemap, no manifest. It runs as **one single-entry `build()` per entry** and drops `bin/`-prefixed entries (a bin is side-effect-only with no exports; its empty declaration only produced a spurious `SOURCEMAP_BROKEN`). A partition whose filtered entry set is empty runs no dts pass. The why of the split and the per-entry determinism are in [Declaration emission](./dts-emission.md).
- **declarations pass** (`deriveDeclarationsPassOptions`, prod-only, when `emitDeclarations: true`): per-module declarations (`unbundle: true` for 1:1 source positions) into `dist/prod/<id>/declarations/`, a sibling of `pkg/` that is never published. It is the input for API Extractor's diagnostics run (see [Meta generation](./meta.md)) and is deliberately neither timed nor recorded by the collector. Dev groups stay two-pass.
- **`emitDts: false`** skips both the dts and declarations passes — no TypeScript compiler load — and threads into the manifest so generated exports carry no `types` condition. The JS pass and the public sync still run.

Every pass sets rolldown's `checks.pluginTimings` to the `verbose` flag: the builder's own always-on plugins trip the plugin-performance diagnostic on virtually every build, so it is noise in normal runs and kept available for profiling. When a `collector` is supplied, each `build()` also gains `logLevel: "silent"`, a `createTsdownLogger` and a `buildMetricsPlugin`, and each pass is timed; without a collector the loop is byte-identical to raw tsdown. See [The build report](./report.md).

## Partitions and per-entry overrides

The per-group body is a partition loop so different entries of one package build with different formats and bundling postures into the same outDir. Partition 0 is the base (the options-level config over `options.entry`); `options.overrides` are partitions 1..n. The driver is silk: its base entries are ESM-only with silk-effects externalized, but `./changesets/markdownlint` must be dual-format CJS that force-bundles silk-effects because markdownlint-cli2 `require()`s it (see `../silk/architecture.md`).

- **`EntryOverride`** is an entry subset plus its own optional `format`/`externals`/`bundle`/`bundleNodeModules`/`bundledPackages`/`dtsExternals` and the three web-runtime fields. **Each partition is built from its own values only** — an option the override omits is absent for that partition, not inherited from the base. `packages/silk/savvy.build.ts` deliberately relies on an override *not* inheriting the base externals.
- **The base `entry` must already exclude the overridden entries**; the bundler's `runBuild` does that partitioning.
- **`clean: true` only on the base partition's JS pass**; every later partition and pass is `clean: false`.
- **The manifest is emitted once per group**, by the base partition's JS pass, with `DualExports` marking which export keys gain a `require` condition (see [Entry detection and manifest emission](./entry-and-manifest.md#manifest-emission)).
- A no-override build is a single base partition running the standard passes.

## Web-runtime partitions

Three additive `EntryOverride` fields let one partition build a browser sub-bundle into an isolated subdir — the mechanism `@savvy-web/rspress-builder` uses for an RSPress `./runtime` (see `../rspress-builder/architecture.md`).

- **`platform`** (`BuildPlatform`: `"node" | "browser" | "neutral"`) changes only the JS pass; the dts pass always compiles as node. **`css`** is forwarded verbatim to the JS pass's tsdown `css` option; `CssOptions` is structurally typed so this package takes no dependency on `@tsdown/css`, which tsdown loads lazily from the consuming package.
- **`outSubdir`** redirects both passes of the partition into `<group>/pkg/<outSubdir>/`. The partition's entry should be `{ index: <barrel source> }`, so the JS pass emits `<outSubdir>/index.js` plus its per-file modules and the dts pass a bundled `<outSubdir>/index.d.ts`. This keeps a bundleless browser sub-package from colliding with the base partition's root-level output and makes the barrel path deterministic. The bundler constructs the partition and enforces one export per `outSubdir`.
- **`subdirExports`** (a set of export keys on `BuildTargetGroupsOptions`) makes the manifest rewrite emit `<entry>/index.{js,d.ts}` for those keys instead of `<entry>.js`.

## Loose files

A loose file is a self-contained bundled output emitted at a literal path inside `pkg/`, outside the exports/dts/meta graph. The driver is pnpm config dependencies, which forbid runtime `dependencies` and resolve `pnpmfile.mjs`/`pnpmfile.cjs` by filename at the package root; the capability generalizes to any "emit this source as a standalone file at this path and format".

- **`normalizeLooseFiles`** (pure) resolves the `LooseFiles` map into `NormalizedLooseFile` descriptors, inferring `format` and `fixedExtension` from the key's extension and throwing `ConfigValidationError` on a path separator, an unsupported or contradicting extension, an ambiguous `.js` with no `format` or `.js`+cjs (deferred — tsdown derives `.cjs` for cjs). It does no filesystem work; a missing source surfaces through tsdown's entry resolution. See `src/build/loose-files.ts` for the rules.
- **Each descriptor is one extra single-entry pass** per group into the group's `pkg/`: bundled (`unbundle: false`), `dts: false`, no manifest, `clean: false`, inheriting the group's `externals`/`bundle`/`bundleNodeModules` posture. A cjs loose file gets the same interop wiring as a dual-format pass (see [Dual-format output](./dual-format.md)).
- **Loose files are not exports** — no manifest entry, no `.d.ts`, no api-model — which is exactly what lets a config dependency ship a manifest with no `dependencies` and no `pnpmfile.*` in `exports`.

Known limitation: there is no collision guard between a loose `outFile` and a real export entry's emitted filename.

## Bundling posture

tsdown auto-externalizes every declared `dependencies`/`peerDependencies`/`optionalDependencies` entry, so `externals` only needs to list *undeclared* transitives that must stay external. Four knobs cover the postures that depart from that default; the rule that ties them together is **the dts pass posture mirrors the JS pass posture**, so bundled declarations never reference a type the runtime bundle inlined or vice versa. The exact `deps` shapes are in `buildTargetGroups`; the topology:

- **`bundleNodeModules`** force-bundles every node_modules/workspace dep not in `externals`, and the dts pass inlines their types so the published package is self-contained. It contributes **no `deps` flag** — bundling undeclared node_modules is already tsdown's default — and acts by flipping the JS pass's `unbundle` to `false`, so both formats bundle into one file per entry. A per-module JS pass would write each inlined dep to its own `node_modules/...`-mirroring sibling file, which `npm pack` strips from the tarball. Do not reintroduce tsdown's deprecated `deps.skipNodeModulesBundle`: tsdown warns on the option's presence regardless of value and only branches on it truthily.
- **`bundle`** force-inlines the listed packages into the JS output (`deps.alwaysBundle`) even if declared — JS-pass-only.
- **`bundledPackages`** inlines only the listed packages' declarations (`deps.dts.alwaysBundle`) and externalizes the rest via `deps.neverBundle: true`, rather than tsdown's `onlyBundle`, which would put the dts pass into strict mode and error on every unlisted reachable type dep. dts-pass-only.
- **`dtsExternals`** externalizes packages in the dts pass only — emitted as `import` references — while the JS pass still bundles them. The dts pass `neverBundle` is the union of `externals` and `dtsExternals`; the JS pass carries `externals` only. The use case is a dependency whose types cannot be safely inlined: `effect`'s cross-module `declare module` augmentations inline into conflicting interface extensions in consumers, so silk lists it here.

The bundler surfaces all four on `defineBuild`; see `../bundler/architecture.md`.

## The define map

Both derive functions inject a `define` map — compile-time global replacements rolldown substitutes at codegen — carrying the package version plus any user `define`.

- **The auto-version key is `process.env.__PACKAGE_VERSION__`**, the member expression consumers actually read. A bare `__PACKAGE_VERSION__` key never matches it, so version injection silently never fires and packages ship reporting `0.0.0`.
- **User `define` is merged after the version key**, so a same-named user key wins. It is build-level — shared by every partition — and forwarded verbatim, so string literals must already be quoted.

## The public/ sync

`copyPublicDir(sourceDir, outDir)` copies the contents of a package's `public/` into the group's `pkg/` root — only the `public/` prefix is dropped, the substructure under it is preserved, and `transformExports` mirrors that drop by stripping a leading `public/` from export values. It runs once per group after every pass has written, so its collision guard sees every built output. It replaces tsdown's `copy` option, whose non-recursive `mkdir` throws `EEXIST` on re-builds and concurrent turbo invocations.

- **Additive, never deleting** — `outDir` is the shared package root the passes own; a `clean: true` build handles stale-asset pruning. A missing `public/` is a no-op.
- **Byte-comparison collision guard.** A destination that already exists with identical bytes is a prior copy and is skipped; anything else — differing bytes, a directory where a file is needed or the reverse — is a built output occupying that path and throws `ConfigValidationError`. The size-then-bytes compare leaves unchanged files and their timestamps alone, so a large copied tree (the mcp markdown corpus under `public/content`) is not rewritten every build.
- **`copyAmbientDts` runs immediately after it** for the group's ambient `.d.ts` exports, byte-stable and verbatim. See [Entry detection and manifest emission](./entry-and-manifest.md#ambient-dts-exports).

Known limitation: on a non-clean rebuild, a file removed from `public/` leaves a stale copy until the next `clean: true` build.

## Minify default

`minify` applies to prod groups only (dev is never minified) and defaults to `false`. This builder targets Node libraries, where readable output matters more than size: minified code trips security scanners and degrades stack traces. A package opts in with `minify: true`.

## Boundaries and invariants

- **The build is two passes by default.** The JS pass owns the outDir (`clean: true`, `dts: false`, `unbundle: true` unless `bundleNodeModules` flips it); the dts pass appends bundled declarations (`clean: false`, `emitDtsOnly: true`, `unbundle: false`). The declarations pass is prod-only and opt-in.
- **The dts pass posture mirrors the JS pass posture.** The dts `neverBundle` is always `externals` ∪ `dtsExternals`; the JS pass carries `externals` only.
- **`bundleNodeModules` contributes no `deps` flag** — it acts through `unbundle: false` alone.
- **Per-entry overrides layer extra partitions into one outDir.** Only the base partition cleans; overrides inherit nothing from the base; the base entry set excludes the overridden entries; the manifest is emitted once.
- **A web-runtime partition is JS-pass-only for `platform`/`css` and outDir-isolated for `outSubdir`.**
- **Loose files are bundled outputs outside the exports graph** — no manifest export, no `.d.ts`, no api-model.
- **The auto-version define key is `process.env.__PACKAGE_VERSION__`**, merged before user `define`.
- **The collector is optional and behavior-preserving.** Absent means byte-identical raw-tsdown output.
- **`copyPublicDir` runs last, is additive and throws on a differing-bytes collision.**

## Rationale

### Why the JS pass and the dts pass are separate builds

tsdown's `unbundle` maps to rolldown `preserveModules` for the whole build, dts plugin included, so one pass can only give per-module JS with per-module dts or bundled JS with bundled dts — never the mix this ecosystem needs. Per-module dts leaves a re-exported type declared in a deep sibling file with no public export subpath unaddressable (TS2883 in consumers; this concretely broke silk's `Preset` facades because `@savvy-web/silk-effects` exports only its root entry). Bundling the JS instead would re-bundle workspace consumers, which crashes at runtime. Bundling only the declarations restores type portability while leaving per-module JS unchanged.

### Why `bundleNodeModules` flips `unbundle`

A self-contained package is the whole promise of the knob, and a `preserveModules` JS pass breaks it silently: each inlined dependency lands in its own `node_modules/`-shaped sibling file, `npm pack` unconditionally strips those directories, and the packed-and-installed esm entry throws `Cannot find module` at load time. Bundling that partition's JS is the only layout that survives the tarball.

### Why `copyPublicDir` compares bytes

A blind copy would rewrite every asset on every build and trip the collision guard on its own prior output. Comparing bytes lets an identical prior copy be skipped, keeps timestamps stable for large asset trees and still refuses to clobber a genuinely different built output.
