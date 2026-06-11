---
status: current
module: tsdown-plugins
category: architecture
created: 2026-06-05
updated: 2026-06-11
last-synced: 2026-06-11
completeness: 90
related:
  - ../bundler/architecture.md
  - ../cli/architecture.md
dependencies:
  - ../bundler/architecture.md
---

# @savvy-web/tsdown-plugins architecture

The interface-only plugin pack that holds every build behavior `@savvy-web/bundler` drives — entry detection, manifest emission, catalog resolution, the dts tsconfig port, the two-pass per-TargetGroup build loop, the configurable esm/cjs output format, the per-entry format/bundling partitions, the configurable bundling posture (force-bundle node_modules, force-inline named packages, selective dts inlining, dts-only externals), the cjs-default-interop plugin, the node-builtin default-interop plugin, the declaration source-map stripper, the full Effect output reporter, the API Extractor meta-generation pipeline, the `publishConfig.targets` derivation, the JSX tsconfig→rolldown mapping, the SEA exe-compile wrapper and the fast-fail config validator. Authored against rolldown's plugin *type* only, so it imports no tsdown runtime and carries no tsdown peer dependency. This doc covers the SP1 foundation plus Track A (meta), Track C (multi-target derivation), Track D (JSX/React), Track B (SEA executables), the §8 config-validation service, M1 (dual-format esm plus cjs), the M2 self-host, the M3 bundled-dts two-pass build and the M4–M6 bundling-posture capabilities (`bundleNodeModules`, `bundledPackages`, `dtsExternals`, the cjs-default-interop plugin and the flat-manifest collision guard) that let the bundler fully replace rslib for cli/mcp/silk, plus the post-M6 hardening: the per-entry format/bundling override partitions, the `bundle` force-inline knob, the node-builtin default-interop plugin, the `defaultManifestTransform` strip default and the declaration source-map stripper.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The interface-only boundary](#the-interface-only-boundary)
- [Effect service and helper map](#effect-service-and-helper-map)
- [Entry detection](#entry-detection)
- [Manifest emission and catalog delegation](#manifest-emission-and-catalog-delegation)
- [The dts resolved-tsconfig port](#the-dts-resolved-tsconfig-port)
- [The two-pass per-TargetGroup build loop](#the-two-pass-per-targetgroup-build-loop)
- [The define map and the version-key fix](#the-define-map-and-the-version-key-fix)
- [The public/ sync](#the-public-sync)
- [Bundled dts: the two-pass split](#bundled-dts-the-two-pass-split)
- [Bundling posture: bundleNodeModules, bundle, bundledPackages, dtsExternals](#bundling-posture-bundlenodemodules-bundle-bundledpackages-dtsexternals)
- [Per-entry format and bundling overrides](#per-entry-format-and-bundling-overrides)
- [Dual-format esm plus cjs](#dual-format-esm-plus-cjs)
- [The cjs-default-interop plugin](#the-cjs-default-interop-plugin)
- [The node-builtin default-interop plugin](#the-node-builtin-default-interop-plugin)
- [The declaration source-map stripper](#the-declaration-source-map-stripper)
- [Fluent manifest and minify defaults](#fluent-manifest-and-minify-defaults)
- [The output reporter](#the-output-reporter)
- [The meta-generation pipeline](#the-meta-generation-pipeline)
- [The targets derivation](#the-targets-derivation)
- [JSX resolution](#jsx-resolution)
- [The SEA exe-compile wrapper](#the-sea-exe-compile-wrapper)
- [The config-validation service](#the-config-validation-service)
- [The escape-hatch contract](#the-escape-hatch-contract)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/tsdown-plugins` is the building blocks; `@savvy-web/bundler` is the thin orchestrator over them (see `../bundler/architecture.md`). Everything the bundler's front door does is exposed here as a helper or a rolldown `Plugin`, so a hand-written `tsdown.config.ts` reproduces the front door by importing the same surface — the published escape hatch.

The package is implemented in Effect (`Data.TaggedError` typed errors, `Context.Tag` services, `Schema`, `Layer`s for the reporter), but Effect runs *behind* the tsdown plugin boundary: the catalog wrapper exposes a `Promise`, and the reporter is rendered via `Effect.runPromise` at the bundler's call site. The plugin objects themselves stay plain rolldown-conformant values.

**Package:** `@savvy-web/tsdown-plugins`
**Location:** `packages/tsdown-plugins` in `savvy-web/systems`
**Public surface:** `src/index.ts` — the semver'd export surface (entry helpers incl. `createEntryName`, manifest transforms + `emitManifest` + `defaultManifestTransform` + the `DualExports` type, `resolveManifest`, dts tsconfig helpers, `deriveTargetGroupOptions`/`buildTargetGroups` + `BuildGroupSpec` + `BuildFormat` + `EntryOverride` + `cjsDefaultInterop` + `nodeBuiltinDefaultInterop` + `removeDeclarationMaps` + `syncPublicDir`, the reporter pipeline + formatters + `BuildReport` schema, the meta surface `normalizeMetaOptions`/`generateMeta` + its option/result types + `MetaGenerationError` + `TsconfigResolver`/`resolvePortableTsconfig` + `PortableTsconfig`/`ResolvedCompilerOptions`, the targets surface `resolveTargets`/`isTargetObject`/`writeTargetsBinding` + the `PublishTargets`/`TargetResolution` types, the jsx surface `resolveJsxConfig`/`readTsconfigJsx` + `JsxConfig`/`TsconfigJsx`, the exe surface `normalizeExeOptions`/`runExeBuild` + its config types + `DEFAULT_EXE_NODE_VERSION`, the config-validation surface `ConfigValidator`/`ConfigValidatorLive` + `ValidationInput` + `ConfigValidationError`, re-exported catalog errors)
**Versioning:** independent; auto-bumps the bundler when it changes.
**Status:** Silk bundler program SP1 (Foundation). Spec/plan (local/gitignored): `docs/superpowers/specs/2026-06-04-savvy-bundler-sp1-foundation-design.md`, `docs/superpowers/plans/2026-06-04-savvy-bundler-sp1.md`.

## Current State

SP1 implemented, plus Track A (API Extractor meta generation, the `src/meta/` module), Track C (the `src/targets/` module — `publishConfig.targets` derivation into byte-variant groups, plus the name-aware TargetGroup plumbing that lets the build loop carry a per-group renamed manifest), Track D (the `src/jsx/` module — tsconfig→rolldown JSX mapping threaded through the dts tsconfig and the build loop), Track B (the `src/exe/` module — SEA executable compilation over `@tsdown/exe`), the §8 config-validation service (`src/config-validation/`), M1 (configurable esm/cjs output format, no new module — it threads `BuildFormat`/`dual`/`cjsDefault` through the existing build loop and manifest transform), the M2 self-host, the M3 bundled-dts two-pass build (no new module — it splits the build loop into a JS pass and a dts pass via `deriveTargetGroupOptions`/`deriveDtsPassOptions`) and the M4–M6 bundling-posture work: `bundleNodeModules`, `bundledPackages` and `dtsExternals` (threaded through the build loop), the `cjsDefaultInterop` rolldown plugin (`src/build/cjs-default-interop.ts`) and the flat-manifest collision guard (the shared `createEntryName` reused by the manifest transform, plus a build-time collision throw in `extractEntries`). Post-M6 hardening then added the **per-entry format/bundling override partitions** (`EntryOverride` + the partition loop in `build-target-groups.ts`, plus the `DualExports` Set form on the manifest transform), the **`bundle` force-inline knob** (tsdown `deps.alwaysBundle`, the inverse of `externals`), the **`nodeBuiltinDefaultInterop` rolldown plugin** (`src/build/node-builtin-default-interop.ts`, fixing a rolldown CJS-codegen defect on default imports of node builtins), the **`defaultManifestTransform`** strip default (`src/manifest/transform.ts`) and the **`removeDeclarationMaps`** stripper (`src/build/strip-maps.ts`). A later round added a build-wide **`define` map** threaded through both passes (with the auto-version key fixed from the bare `__PACKAGE_VERSION__` to `process.env.__PACKAGE_VERSION__` so version injection actually fires) and the auto-injected **`./package.json` self-export** in `transformManifest`. **This package now builds itself** via an escape-hatch `savvy.build.ts` (it dropped the rslib devDeps + `rslib.config.ts`, and keeps a synced local `ecma.json` tsconfig base — see `../bundler/architecture.md`). Its build script still runs `tsx savvy.build.ts` (the one package that cannot use `node` native type-stripping, since the file imports its own un-built `./src`); its `savvy.build.ts` externalizes `typescript` (now a runtime dep) so the compiler is not inlined into the bundle. Runtime `dependencies` are `workspaces-effect` (`^1.2.0`, for `CatalogResolver`), `@effect/platform-node` (provides `NodeContext` at the resolution boundary), `sort-package-json`, `std-env`, `picocolors`, `json-schema-effect`, `typescript` (moved from devDep — the tsconfig-resolver uses the TS compiler API at runtime; it is externalized in this package's own `savvy.build.ts` so the ~8 MB compiler is not bundled and resolves at runtime instead), plus the meta deps `@microsoft/api-extractor`, `@microsoft/tsdoc`, `@microsoft/tsdoc-config` and `deep-equal`; `effect` is a `catalog:silkPeers` peer. `tsdown`/`rolldown` are devDependencies — types only. (The `@tsdown/exe` runtime dependency lives on the *bundler*, not here — tsdown lazily imports it; see `../bundler/architecture.md`.)

Out of SP1/Tracks A/B/C/D/M1/M2/M3/M4–M6: the SP2 preflight findings the reporter will later carry, per-variant meta (meta is still emitted once into the canonical group) and **Track E (full publishability)**, which is not done. Self-hosting is now COMPLETE — this package and the bundler self-build, and all nine in-repo packages build through the bundler. `@savvy-web/rslib-builder` and `@rslib/core` are decommissioned from `systems` (M6). The error set, formatter set, service set, the `resolveTargets` validation cases and the `ConfigValidator` rule set are discoverable in source — this doc documents the topology, not the enumerations.

## The interface-only boundary

The cardinal architectural decision: **plugins are authored against `import type { Plugin } from "rolldown"` only.** No tsdown runtime is imported anywhere in the source except one lazy dynamic import behind an injectable seam (`build-target-groups.ts` does `(await import("tsdown")).build` only when the caller does not inject a `build` fn). Consequences:

- No tsdown peer dependency. The bundler brings tsdown; an escape-hatch user brings their own. A documented compat range against tsdown's plugin type is the only coupling.
- Effect lives behind the boundary. Plugin hooks and the catalog wrapper present plain values (`Plugin`, `Promise`); the bundler runs the reporter Effect at its own call site.

## Effect service and helper map

The surface divides into pure helpers, one rolldown plugin, one async catalog wrapper and the reporter's Effect services. Point of entry for each is its source file:

- **Entry:** `extractEntries` (pure, `src/entry/extract.ts`), `packageJsonEntries` (`src/entry/package-json-entries.ts`).
- **Manifest:** pure transforms `transformManifest`/`transformExports`/`transformBin`/`normalizeBinPaths` (`src/manifest/transform.ts`); the `emitManifest` rolldown plugin + `buildEmittedManifest` (`src/manifest/emit-manifest.ts`).
- **Catalog:** `resolveManifest` — a thin async `Promise` wrapper over `workspaces-effect`'s `CatalogResolver` (`src/catalog/resolve-catalogs.ts`).
- **dts:** `buildResolvedTsconfig`/`writeResolvedTsconfig` (`src/dts/resolved-tsconfig.ts`).
- **Build loop:** `deriveTargetGroupOptions` (pure, `src/build/target-groups.ts`), `buildTargetGroups` (`src/build/build-target-groups.ts`). The loop is driven by `ReadonlyArray<BuildGroupSpec>` (`{ id, name }`), so each group carries its own resolved manifest name.
- **Public-dir sync:** `syncPublicDir` (`src/build/sync-public.ts`) — the idempotent `public/` mirror that replaces tsdown's built-in `copy`. See [The public/ sync](#the-public-sync).
- **Targets:** the pure `src/targets/` module — `resolveTargets`/`isTargetObject` + the public/resolved types (`config.ts`, `resolve-targets.ts`) and `writeTargetsBinding` (`binding.ts`). See [The targets derivation](#the-targets-derivation).
- **JSX:** the pure `src/jsx/config.ts` — `resolveJsxConfig` (tsconfig→rolldown mapping) and `readTsconfigJsx` (best-effort source-tsconfig read). See [JSX resolution](#jsx-resolution).
- **Exe:** the `src/exe/` module — `normalizeExeOptions` + its config types (`config.ts`) and `runExeBuild` (`build.ts`, the interface-only tsdown-exe wrapper). See [The SEA exe-compile wrapper](#the-sea-exe-compile-wrapper).
- **Config validation:** the `src/config-validation/` module — the `ConfigValidator` `Context.Tag` service + `ValidationInput` (`ConfigValidator.ts`) and `ConfigValidatorLive` (`ConfigValidatorLive.ts`). See [The config-validation service](#the-config-validation-service).
- **Reporter:** four `Context.Tag` services `EnvironmentDetector → ExecutorResolver → FormatSelector → OutputRenderer` each with a sibling `*Live` layer, composed into `ReportPipelineLive`; the `renderReport` program; five formatters; the `BuildReport` `Schema` and its SchemaStore export. See [The output reporter](#the-output-reporter).
- **Meta:** the `src/meta/` module — `normalizeMetaOptions` + types (`config.ts`), `createMessageSuppressor` (`message-suppressor.ts`), `buildTsdocConfig`/`writeTsdocConfig` (`tsdoc-config.ts`), `mergeApiModels`/`rewriteCanonicalReferences` (`merge-models.ts`), `runApiExtractor` (`api-extractor.ts`) and the `generateMeta` orchestrator (`generate.ts`). See [The meta-generation pipeline](#the-meta-generation-pipeline).
- **Errors:** typed `Data.TaggedError`s in `src/errors.ts` (including `MetaGenerationError`, thrown by `runApiExtractor` on a failed extraction, and `ConfigValidationError` `{ path, reason }`, the single typed error every structural-config guard raises — `resolveTargets`, the exe/meta checks and the `ConfigValidator` — both re-exported from `src/index.ts` so consumers can `catchTag` by type); the catalog errors (`CatalogAssemblyError`, `CatalogResolutionError`) are owned by `workspaces-effect` and re-exported from `src/index.ts` so consumers and the reporter can `catchTag` them.

## Entry detection

`extractEntries` ports rslib-builder's `EntryExtractor` rules **exactly** — this is core identity that must not drift. The rules (source of truth if in doubt: rslib `entry-extractor.ts`): read `exports`; skip `./package.json` and any `*.json`; resolve an export value as `import || default || types` (never `require`); `resolveToTypeScript` remaps `/dist/`→`/src/` and `.js`→`.ts`; keep only `.ts`/`.tsx`; name `.`→`index`, else strip leading `./` and flatten `/`→`-` (or nest under `<name>/index` when `exportsAsIndexes`); `bin` string → `bin/cli`, object → `bin/<command>`, each through `resolveToTypeScript`. The naming is centralized in the exported `createEntryName` helper, which the manifest transform reuses (see [Manifest emission](#manifest-emission-and-catalog-delegation)) so the declared output path always matches the emitted basename. `packageJsonEntries` is the tsdown-facing wrapper returning the `Record<name, path>` that tsdown's `entry` accepts, reading either an in-memory package.json or `<cwd>/package.json`.

**The slash-to-dash flatten is not injective, so `extractEntries` throws on collision.** Two distinct export keys can flatten to the same entry name (`./a-b/c` and `./a/b-c` both → `a-b-c`); a silent overwrite would corrupt one entry and its manifest target, so the extractor fails loudly with both colliding keys named. This guard is what makes silk's nested subpath exports (`./changesets/markdownlint` etc.) safe under the flat-manifest scheme below.

## Manifest emission and catalog delegation

`emitManifest` is the one rolldown plugin: in `generateBundle` it reads the source `package.json`, builds the transformed manifest via `buildEmittedManifest`, emits it as `package.json` into the output `pkg/` and copies `LICENSE`/`README.md`. The transform pipeline (ported from rslib's `package-json-transformer.ts`): resolve catalogs (prod, or dev when `devManifest: "resolve"`) → **apply the declarative rename** (`base.name = targetGroup.name`) → strip `publishConfig`/`scripts` → set `private` from `publishConfig.access` → rewrite `exports`/`bin`/`types` to built `.js`/`.d.ts` (and a `require: .cjs` condition for the dual-format exports, which can be ALL exports or a per-entry subset — see [Dual-format esm plus cjs](#dual-format-esm-plus-cjs) and [Per-entry format and bundling overrides](#per-entry-format-and-bundling-overrides)) → **inject the `./package.json` self-export** → run the user `transform({ pkg, targetGroup })` → **strip leading `./` from bin paths as the final guard** (npm 11.x silently drops `./`-prefixed bins) → `sort-package-json`. The `process.env.__PACKAGE_VERSION__` define is injected by the build loop, not here.

**The `./package.json` self-export is auto-injected (standard npm practice).** `transformManifest` adds `"./package.json": "./package.json"` to the `exports` map so consumers can `import "name/package.json"`. It runs ONLY when an `exports` field is present (a package with no exports already exposes everything; injecting a single-key map would REGRESS that to package.json-only), runs BEFORE the user `transform` so a custom transform can strip it, is idempotent (no-op when the key already exists) and keys the wrap decision off the ORIGINAL exports TYPE: a bare-string exports is promoted to `{ ".": <conditions>, "./package.json": "./package.json" }` (after `transformExports` a bare string becomes a conditions object indistinguishable from a map, so the wrap must be decided pre-transform).

**`defaultManifestTransform` is the strip every package used to hand-write.** Nearly every package's `transform` was an identical block deleting the build/dev-only fields (`devDependencies`, `bundleDependencies`, `scripts`, `publishConfig`, `packageManager`, `devEngines`) — a pattern inherited from rslib-builder. That block is now the exported `defaultManifestTransform`, which the bundler's `defineBuild` applies as the DEFAULT `transform` when none is supplied (see [Fluent manifest and minify defaults](#fluent-manifest-and-minify-defaults)). A custom `transform` REPLACES it, so a package doing genuinely custom manifest work (silk's peerDep promotion, the two self-hosting builders) imports and calls `defaultManifestTransform` itself to keep the stripping. It is reading-safe: the bundler reads everything it needs from the source manifest before transforms run.

**The export-path rewrite derives the built basename from the entry NAME, not the source path (flat-manifest fix).** `transformExports` maps each export key through the same `createEntryName` the entry extractor uses (`./commitlint` → `commitlint.js`, `./changesets/markdownlint` → `changesets-markdownlint.js`), so the declared `import`/`types`/`require` target always matches the flattened file tsdown actually emits. The earlier rewrite keyed off the source path and produced wrong nested subpaths for packages like silk; mirroring the entry namer is the load-bearing fix and is why the entry namer is exported and shared.

**The declarative rename (Track C) is load-bearing for ordering.** `buildEmittedManifest` sets `base.name = targetGroup.name` AFTER the catalog resolve and BEFORE the user `transform`, so the user transform and the emitted manifest both observe the renamed package — this is how a `github`/string-override group emits a differently-named manifest (and therefore distinct publishable bytes) without per-group transform code. `TargetGroupRef` carries `name` alongside `id`/`isProd` for this reason.

**Catalog delegation is the key revision from the original plan and the load-bearing topology fact here.** `resolveManifest` does *not* reimplement catalog/`workspace:` resolution — it wraps `workspaces-effect`'s `CatalogResolver`, which assembles a workspace's complete pnpm catalog set generically (inline `pnpm-workspace.yaml` + config-dependency pnpmfile hook-replay + lockfile) and resolves specifiers durably **without** depending on the transient `.pnpm-workspace-state-v1.json` — the fix for the `catalog:silkPeers` ordering bug. The resolver discovers the workspace root from `process.cwd()` (no cwd parameter), so `resolveManifest` must run from inside the target workspace; catalogs are workspace-wide so any cwd inside it yields the same set. `buildEmittedManifest` only resolves when `targetGroup.isProd || devManifest === "resolve"`, so a `dev` group with `devManifest: "preserve"` (the default) keeps `catalog:`/`workspace:` specifiers intact for injected dev packages to resolve through the workspace.

## The dts resolved-tsconfig port

SP1 decision: **tsdown native dts on the tsc path, NOT isolatedDeclarations.** Without `isolatedDeclarations`, rolldown-plugin-dts falls back to the TS compiler for emit, which under pnpm symlinks reproduces rslib's TS2742/TS2883 portability failures. The fix is ported from rslib's `writeBundleTempConfig`: `writeResolvedTsconfig` writes a temp tsconfig with **absolute** `rootDir`/`include`/`typeRoots`, explicit `types` (forwarded from the project tsconfig, default `["node"]`) and `composite: false`/`incremental: false` so stale build info never skips emit. The orchestrator passes that temp path to tsdown's `dts: { tsconfig }`. `ResolvedTsconfigOptions` also takes optional `jsx`/`jsxImportSource` (Track D) so the dts compiler sees the same JSX runtime the build does — otherwise `.tsx` declaration emit fails. See `src/dts/resolved-tsconfig.ts` for the exact compilerOptions.

## The two-pass per-TargetGroup build loop

Each TargetGroup runs **two** `tsdown.build()` calls to the same outDir: a JS pass then a dts pass (M3 — see [Bundled dts: the two-pass split](#bundled-dts-the-two-pass-split) for why). Both derive from the same `DeriveOptions`:

- **`deriveTargetGroupOptions` (pure, the JS pass)** maps a `TargetGroupId` to the JS-pass options: `outDir` (`dev → dist/dev/pkg`, prod → `dist/prod/<group>/pkg`), `sourcemap`/`minify` (dev lenient, prod minified), `format` (`options.format ?? ["esm"]` — M1), `unbundle: true`, `dts: false`, `clean: true`, `platform: "node"`, `fixedExtension: false` and the auto-version + user `define` map (see [The define map and the version-key fix](#the-define-map-and-the-version-key-fix)).
- **`deriveDtsPassOptions` (pure, the dts pass)** maps the same input to the dts-only options: same `outDir`, `unbundle: false`, `clean: false` (load-bearing — it must not wipe the JS pass output), `dts: { tsconfig, emitDtsOnly: true }`, no sourcemap.

Track C widened `TargetGroupId` from the SP1 `"dev" | "npm"` union to any `string` — a prod group id is now an arbitrary `publishConfig.targets` key (`npm`, `github`, a custom key) — and the loop input is `ReadonlyArray<BuildGroupSpec>` (`{ id, name }`) rather than bare ids, so each group threads `group.id` into both derive functions/the output dir and `group.name` into its `TargetGroupRef` for the declarative rename. `buildTargetGroups` runs the two `tsdown.build()` passes per group with `config: false`; only the JS pass wires in the per-group `emitManifest` plugin (the dts pass emits no manifest, no sourcemap), `public/` is mirrored once via `syncPublicDir` after the JS pass owns the outDir (see [The public/ sync](#the-public-sync)), and both passes carry `deps.neverBundle` externals. Track D threads an optional `jsx?: JsxConfig` through `DeriveOptions`/`DerivedTsdownOptions`/`DerivedDtsPassOptions`/`BuildTargetGroupsOptions` into each pass's `inputOptions.jsx` (the dts compile honors JSX too); M1 threads an optional `format?: ReadonlyArray<BuildFormat>` through the same option types (see [Dual-format esm plus cjs](#dual-format-esm-plus-cjs)); an optional `define?: Record<string, string>` threads the same way into both passes' `define` map (see [The define map and the version-key fix](#the-define-map-and-the-version-key-fix)); M4–M6 thread `bundleNodeModules`/`bundle`/`bundledPackages`/`dtsExternals` into the per-pass `deps` shapes (see [Bundling posture](#bundling-posture-bundlenodemodules-bundle-bundledpackages-dtsexternals)) and conditionally attach `cjsDefaultInterop` AND `nodeBuiltinDefaultInterop` to whichever passes emit a `.cjs`. Post-M6 the per-group body became a PARTITION loop (base partition + `options.overrides`) so different entries build with different formats into the same outDir; see [Per-entry format and bundling overrides](#per-entry-format-and-bundling-overrides). Two SP1 facts cross into tsdown here: `unbundle: true` (JS pass) is the `disableSharedChunks` analogue (rolldown `preserveModules`, no shared runtime chunk), and `fixedExtension: false` forces package-`type`-ambient extensions over tsdown's node default. The loop is exposed as a composable helper — **not** locked inside the bundler — so the escape hatch gets multi-group builds too. `tsdown.build` is injectable on the options for tests, the only place tsdown's runtime is touched.

## The define map and the version-key fix

Both derive functions inject a `define` map into their tsdown build — compile-time global replacements rolldown substitutes at codegen. It carries the package version plus any user-supplied `define`.

- **The auto-version key is `process.env.__PACKAGE_VERSION__`, not the bare identifier.** The build auto-injects the package version so a package can report its own version without reading `package.json` at runtime. The key was originally the BARE `__PACKAGE_VERSION__`, which rolldown never matched against the `process.env.__PACKAGE_VERSION__` member expression every consumer actually reads — so version injection silently never fired and the cli/github-action-builder shipped reporting `0.0.0`. Both passes now key it as `process.env.__PACKAGE_VERSION__` (`deriveTargetGroupOptions` + `deriveDtsPassOptions`), so the substitution lands.
- **User `define` is merged after the version key.** `DeriveOptions.define` is spread AFTER the auto-version entry in both passes, so a user key of the same name wins. `define` is build-level — shared by every entry partition (not per-override) — and forwarded verbatim (string literals must already be quoted). The bundler surfaces `defineBuild({ define })` and conditional-spreads it through `buildTargetGroups` (see `../bundler/architecture.md`).

## The public/ sync

`syncPublicDir(sourceDir, targetDir)` (`src/build/sync-public.ts`) mirrors a package's `public/` into the group's `pkg/public` and **replaces tsdown's built-in `copy` option**. The build loop calls it once per group, right after the JS pass owns the outDir, instead of passing `copy: ["public"]` to tsdown.

- **Why it replaces `copy`.** tsdown's `copy` does a non-recursive `mkdir` that throws `EEXIST` when the target dir already exists — which happens on re-builds and concurrent turbo invocations. `syncPublicDir` is idempotent: source absent → no-op; target absent → wholesale recursive copy; target present → copy only new-or-byte-changed files, delete target files no longer in the source, then prune the directories left empty.
- **Why byte-diff, not blind copy.** The byte comparison (size first, then `Buffer.equals`) leaves unchanged files and their timestamps untouched, so a large copied asset tree — concretely the mcp markdown corpus relocated under `public/content` — is not rewritten on every build.

## Bundled dts: the two-pass split

M3 made bundled (rolled-up, self-contained) declarations the **default**, not opt-in. The build now runs two tsdown passes per TargetGroup because **`unbundle` maps to rolldown `output.preserveModules` for the WHOLE build, including the dts plugin** — so a single pass can only give per-module JS + per-module dts, or bundled JS + bundled dts, never the mix the ecosystem needs.

- **JS pass:** `unbundle: true`, `dts: false`, default `clean: true`. Per-module `.js` (plus `.cjs` when dual). Runs the `emitManifest` plugin exactly once; `public/` is mirrored by `syncPublicDir` right after this pass (it owns the outDir).
- **dts pass:** `unbundle: false`, `dts: { emitDtsOnly: true }`, `clean: false` (so it appends to — never wipes — the JS pass output). A single rolled-up `.d.ts` per public entry (plus `.d.cts` when dual). No manifest, no copy, no sourcemap.

**Why the mix is required.** Per-module dts leaves a re-exported type declared in a deep sibling file with no public export subpath unaddressable, so a consumer inferring such a type hits TS2883 — this concretely broke the silk `Preset` lint/commitlint facades because `@savvy-web/silk-effects` exports only its root entry. Bundling the **JS** instead would re-bundle workspace consumers (silk's rslib re-bundle of silk-effects crashes at runtime). Bundling only the declarations restores type portability while leaving per-module JS unchanged. The full empirical finding lives in the TSDoc on `DerivedTsdownOptions`/`DerivedDtsPassOptions` in `src/build/target-groups.ts`.

## Bundling posture: bundleNodeModules, bundle, bundledPackages, dtsExternals

M4–M6 added four knobs that control which dependencies get bundled into the JS vs the dts, so the bundler can reproduce every rslib bundling posture (needed to migrate cli/mcp/silk off rslib). They thread through `BuildTargetGroupsOptions` and `DeriveOptions`; the load-bearing rule is **the dts pass posture mirrors the JS pass posture** so the bundled declarations stay consistent with the runtime bundle. The exact `deps` shapes are in `buildTargetGroups`' comment block — the topology:

**tsdown already auto-externalizes declared deps, so most `externals` lists were redundant.** tsdown's `DepsPlugin` (`getProductionDeps`) externalizes everything in `dependencies` + `peerDependencies` + `optionalDependencies` by default. The post-M6 cleanup dropped the now-redundant explicit `externals` from cli/mcp/templates/silk-effects entirely; github-action-effects keeps only the three UNDECLARED `@effect/*` transitives (`@effect/cluster`/`@effect/rpc`/`@effect/sql`, which tsdown would otherwise bundle), and silk keeps `source-map-support` (transitive, undeclared). The remaining knobs are for the postures that DEPART from this default.

- **`bundleNodeModules: true`** sets tsdown `deps.skipNodeModulesBundle: false` on the JS pass, force-bundling every node_modules/workspace dep not in `externals` (rslib's bundle-everything-except-externals). The dts pass mirrors it (`skipNodeModulesBundle: false`), inlining those node_modules types into the `.d.ts` so the published package is self-contained and needs no extra declared deps. Defaults off. This is what makes silk a self-contained CJS-requireable artifact.
- **`bundle`** (the inverse of `externals`) force-INLINES the listed packages into the JS output via tsdown `deps.alwaysBundle`, even declared deps tsdown would otherwise auto-externalize. JS-pass-only — declarations are NOT inlined by it (`bundledPackages` does that). It is allowed alongside `skipNodeModulesBundle: false` (tsdown's mutual-exclusion throw fires only when `skipNodeModulesBundle` is true). Use it to declare a dependency for metadata/types but ship its code inline.
- **`bundledPackages`** (rslib `dtsBundledPackages` parity) inlines ONLY the listed packages' declarations and externalizes the rest. Maps to tsdown `deps.dts.alwaysBundle` in the dts pass; the JS pass is unaffected. Because tsdown's `onlyBundle` would put the dts pass into strict mode (erroring on every reachable type dep not listed), the implementation instead externalizes all node_modules (`skipNodeModulesBundle: true`) and force-bundles only the listed packages via `deps.dts.alwaysBundle`, which is exempt from tsdown's `skipNodeModulesBundle`-vs-`alwaysBundle` mutual-exclusion check.
- **`dtsExternals`** externalizes packages in the dts pass ONLY — emitted as `import` references in the `.d.ts` rather than inlined — while the JS pass still bundles them per `bundleNodeModules`. The dts pass `neverBundle` is the UNION of `externals` and `dtsExternals`; the JS pass `neverBundle` carries `externals` only. The use case is a dependency whose types cannot be safely inlined: effect's cross-module `declare module` augmentations inline into conflicting interface-extension errors (TS2320) in consumers, so silk lists `effect`/`@effect/platform` here and declares them as runtime deps.

`bundleNodeModules`/`bundledPackages`/`dtsExternals` combine into the three-way dts posture the build loop encodes (`bundleNodeModules` → inline all; `bundledPackages`-only → externalize-the-rest + inline-listed; plain → the leaf bundled-dts default); `bundle` is an orthogonal JS-only force-inline. The bundler surfaces all four on `defineBuild`; see `../bundler/architecture.md`.

## Per-entry format and bundling overrides

Post-M6 hardening generalized the per-group build body into a PARTITION loop so DIFFERENT entries of one package can build with different formats and bundling postures into the SAME outDir. The driver is silk: its base entries are ESM-only with silk-effects externalized, but its `./changesets/markdownlint` entry must be dual-format CJS that force-bundles silk-effects (markdownlint-cli2 `require()`s it and cannot require ESM-only silk-effects). See [How silk builds](../silk/architecture.md).

- **`EntryOverride`** (`build-target-groups.ts`) is an entry subset (entryName → source) plus its own optional `format`/`externals`/`bundle`/`bundleNodeModules`/`bundledPackages`/`dtsExternals`. Anything omitted falls back to the base partition's value.
- **The partition loop.** For each group, partition 0 is the base (the options-level config over `options.entry`); `options.overrides` are partitions 1..n. They are layered into the same outDir: `clean: true` only on the base partition's JS pass (it owns the outDir), every later partition is `clean: false`. The base `entry` must already EXCLUDE the overridden entries — the bundler's `runBuild` does that partitioning (see `../bundler/architecture.md`).
- **The manifest is emitted ONCE per group**, by the base partition's JS pass, covering the whole package with per-entry dual conditions.
- **`DualExports = boolean | ReadonlySet<string>`** (`manifest/transform.ts`) is how per-entry formats reach the manifest. `true`/`false` apply the `require` condition uniformly to every TS export; a Set marks ONLY the listed export keys (e.g. `"./changesets/markdownlint"`) as dual, so some exports get a `require` condition and others stay import-only. It threads `buildTargetGroups` (`dualExports`) → `emitManifest` → `transformManifest` → `transformExports`. The bundler computes the Set from which overrides (and which base entries) emit cjs.
- **A no-override build is byte-identical to before** — with no `overrides`, the loop is a single base partition exactly as the M3 two-pass loop ran.

## Dual-format esm plus cjs

M1 lifts the build's previously-hardcoded `format: ["esm"]` to a configurable `BuildFormat = "esm" | "cjs"` array (default `["esm"]`), so a package can emit both formats — the rslib parity target for CJS consumers. There is no new module; the capability threads through the existing build loop and manifest transform. Three things change when `"cjs"` is in the format, each derived from `format.includes("cjs")`:

- **Output:** `deriveTargetGroupOptions` passes the full `format` array to the tsdown build, which emits esm `index.js` plus cjs `index.cjs` (and `index.d.ts` plus `index.d.cts`). **`fixedExtension` stays `false`** (narrowed to the `false` literal): the empirical finding (verified against tsdown 0.22.2 for a `type: module` package) is that `false` already yields the `.js`/`.cjs` scheme with no collision, while `true` would wrongly give `.mjs`. See the `fixedExtension` TSDoc in `src/build/target-groups.ts` for the full finding.
- **CJS interop:** `cjsDefault: true` (tsdown's real option, mapping to rolldown `output.exports: "auto"` — the rslib `cjsInterop` equivalent) is set on the build only when cjs is present, so a `require()` returns the value and named exports survive. esm-only builds leave the tsdown default untouched and stay byte-identical.
- **Manifest:** the `dual` boolean (`derived.format.includes("cjs")`) threads `build-target-groups.ts` → `emit-manifest.ts` (`EmitManifestOptions`/`BuildEmittedManifestOptions`) → `transformManifest` → `transformExports(exports, dual)`. When dual, each TS export condition gains a flat `require: toBuiltCjs(p)` alongside `types`/`import` (`{ types: .d.ts, import: .js, require: .cjs }`). Non-TS exports pass through untouched. The `.d.cts` declaration is emitted automatically by the dts pass; no extra flag.

The default `["esm"]` path is unchanged in every respect, so M1 is a dormant capability until a package opts in. The bundler surfaces the `defineBuild({ format })` knob and forwards it; see `../bundler/architecture.md`.

## The cjs-default-interop plugin

`cjsDefaultInterop` (`src/build/cjs-default-interop.ts`) is the rslib `cjsInterop: true` equivalent and the second half of the dual-format CJS story (the first being `cjsDefault`/`output.exports`). It is a rolldown plugin that appends an interop footer to a CJS ENTRY chunk that exports a `default` alongside named exports, reassigning `module.exports` to the default value and re-attaching the named exports as own properties of it.

- **Why it exists.** rolldown's `output.exports` cannot natively emit `module.exports = <default>` while ALSO keeping named exports: for a default+named module both `"auto"` and `"named"` emit `exports.default = <default>` (verified against rolldown 1.1.0), so an ESM consumer doing `import(x).default` receives the `{ default, ...named }` wrapper rather than the default value. The footer restores rslib's behavior so `import(x).default === <default>` and `require(x) === <default>`. The concrete consumer is markdownlint-cli2, which `await import(fileURL)`s silk's `./changesets/markdownlint` and reads `module.default` expecting the rules ARRAY; without the footer it gets the wrapper and aborts.
- **Tight gating.** The plugin fires only on `format === "cjs"`, only on ENTRY chunks (never SHARED chunks, whose `module.exports` is read by other chunks via named bindings) and only when the chunk has both a `default` and at least one named export. The emitted footer is additionally self-guarded at runtime.
- **Primitive-default limitation.** Promotion only happens when the default is an object/function (a primitive cannot carry the re-attached named props); a primitive default + named exports leaves the wrapper and emits a one-line `console.warn` so the no-op is observable. This case does not occur in the suite today.
- **It runs in BOTH passes for dual-format builds.** tsdown's dts pass re-emits the `.cjs` JS chunk (overwriting the JS pass's footer'd `.cjs` with a footer-less one), so `buildTargetGroups` attaches the plugin to the dts pass too whenever cjs is in the format — otherwise the final `.cjs` would lose the footer. This is the one place an `extraPlugins`-style hook is deliberately run twice; the gating makes it a no-op on every other chunk.

## The node-builtin default-interop plugin

`nodeBuiltinDefaultInterop` (`src/build/node-builtin-default-interop.ts`) is the second cjs-only interop plugin, fixing a rolldown 1.1.0 CJS-codegen DEFECT (verified against rolldown 1.1.0 / tsdown 0.22.2, no newer release): for a DEFAULT import of an external node builtin, rolldown emits a bare `require("node:x")` WITHOUT its `__toESM` interop wrapper yet still accesses `.default` — which is `undefined` on a builtin's CJS export object, so the call throws `Cannot read properties of undefined` at runtime. The concrete victim was vfile's `export {default as minproc} from 'node:process'` bundled into silk's `.cjs`, which crashed `savvy changeset version`.

- **It is a `transform` plugin, not a `renderChunk` footer.** It rewrites the default import/re-export of a node builtin into the equivalent NAMESPACE form BEFORE codegen (`import NAME from "node:x"` → `import * as NAME from "node:x"`, `export {default as NAME} from "node:x"` → `export * as NAME from "node:x"`, and the default+named combined form into two statements). rolldown wraps a namespace import correctly (`__toESM(require("node:x"), 1)`, which synthesizes `.default` and copies every own property), so member access works.
- **Why on the source, not the output.** rolldown exposes no Rollup-style `output.interop` knob to fix this at the output layer. Rewriting before codegen also makes it immune to minification and identical for per-module and bundled output.
- **It is matched by statement-anchored regexes** (anchored to line start so an import-like string literal is not matched) gated on `isNodeBuiltin` (a `node:` prefix or a bare `builtinModules` name). cjs-only and a no-op for esm. Like `cjsDefaultInterop`, `buildTargetGroups` attaches it to BOTH the JS pass and the dts re-emit pass whenever cjs is in the format.

## The declaration source-map stripper

`removeDeclarationMaps(pkgDir)` (`src/build/strip-maps.ts`) recursively removes `.d.ts.map`/`.d.cts.map` files from a built `pkg/` dir (skipping `node_modules` so it does not traverse a self-contained bundle's vendored tree), returning the removed paths. The dts pass emits these maps because the resolved dts tsconfig sets `declarationMap: true` — API Extractor reads them during meta generation to resolve original-source positions. But they are dead weight in a PUBLISHED package: they reference `.ts` sources the tarball does not ship and they leak local source paths. The bundler strips them from each prod group AFTER meta generation has consumed them; the dev build keeps them (never published, and `savvy build --target meta` reads them). The two self-hosting builders call it directly from their escape-hatch `savvy.build.ts`; see `../bundler/architecture.md`.

## Fluent manifest and minify defaults

Two defaults moved into the build so packages stop carrying boilerplate:

- **`defaultManifestTransform` as the default `transform`.** Documented under [Manifest emission](#manifest-emission-and-catalog-delegation) — the strip block nearly every package hand-wrote is now the bundler's default when no `transform` is supplied; a custom transform replaces it and re-imports it to keep the strip.
- **Prod output is now UNMINIFIED by default.** The `minify` option on `BuildTargetGroupsOptions` (and `defineBuild`) applies to PROD groups ONLY (dev is never minified) and defaults to FALSE. The prior `minify: isProd` became `minify: isProd && (options.minify ?? false)`, flipping the prior prod-minified default. This builder targets Node LIBRARIES, where readable output matters more than bundle size: minified/obfuscated code trips security/SCA scanners and degrades stack traces. A package opts back in with `minify: true`.

## The output reporter

Mirrored (copied, not shared) from the `spencerbeggs/vitest-llm-reporter` / `vitest-agent-reporter` pattern — own the code now, consolidate to a shared package later only if it proves worth it. It replaces rslib's `build-logger.ts` (rsbuild-logger-coupled, human-only); the generic `createTimer`/`formatTime` helpers carry over (`src/report/timer.ts`).

- **Pipeline:** four `Context.Tag` services with `*Live` layers — `EnvironmentDetector → ExecutorResolver → FormatSelector → OutputRenderer` — composed in `ReportPipelineLive`. `renderReport(reports, options)` is the Effect program threading them (`src/report/pipeline.ts`); the bundler runs it via `Effect.runPromise`.
- **Modes/executors:** `human` (pretty terminal, picocolors), `agent` (markdown, failures-first/deduped/token-efficient — the agent-token-burn fix), `ci` (GitHub `::error::` annotations).
- **Mode selection:** auto-detect via `std-env` (`isAgent`) > `GITHUB_ACTIONS` > `CI` > TTY default; explicit override wins (`output.format` in `savvy.build.ts`, or a `--format` flag). Precedence is settled in `FormatSelector.select(executor, explicitFormat?, env?)`.
- **Formatter contract:** `render(reports, ctx) → RenderedOutput[]`, each `{ target, content, contentType }`, sync and pure. Formatters: `terminal`, `json`, `markdown`, `ci-annotations`, `silent`.
- **`BuildReport` Schema (SP1 shape):** per package → per TargetGroup `{ entries, emittedFiles, timings, warnings[], errors[] }`. SP2 extends it with `wouldFailProd[]`. A SchemaStore-compatible JSON Schema is emitted via `json-schema-effect` (`src/report/schema-export.ts`) so the structured `json`/`markdown` output validates and editors get autocomplete.

## The meta-generation pipeline

Track A added `src/meta/`, which holds **all** the meta behavior the bundler wires; the bundler owns no meta logic of its own (see `../bundler/architecture.md`). Meta is the API Extractor `.api.json` model the bundler emits into other packages' `localPaths` (for downstream API-doc consumers like mcp) and, on a prod build, into the `meta/` release-asset bundle. It is deliberately **decoupled from the prod tsdown build**: generating meta runs API Extractor over the already-emitted dev `.d.ts`, not as part of bundling.

The module is a set of separately-tested units; each file is the source of truth for its own mechanics:

- **`generateMeta` (`generate.ts`)** — the orchestrator. Writes `tsdoc.json`, runs the extractor once per entry into `outMetaDir`, takes the single model or `mergeApiModels` when more than one entry, writes the **"virtual TS env" trio** into `outMetaDir` — `<unscoped>.api.json` + the FINAL transformed `package.json` (copied from the built `pkg/` dir, not the source manifest) + a PORTABLE derived `tsconfig.json` (from `resolvePortableTsconfig`) — copies that trio into each `localPaths` dir, and removes the per-entry `*.entry.api.json` intermediates so they never leak into the bundle. The api-extractor `tsdoc-metadata.json` is written into the built `pkg/` dir (a published-package artifact TSDoc tooling reads from the package root), **not** into the meta bundle.
- **`runApiExtractor` (`api-extractor.ts`)** — single-entry wrapper over the real `@microsoft/api-extractor`, configured in-memory via `ExtractorConfig.prepare({ configObject })` (no `api-extractor.json` file) with `dtsRollup`/`apiReport` disabled and the message suppressor wired into the `messageCallback`. It runs over the tsdown-emitted per-file `.d.ts` (unbundle dts) using the SP1 resolved tsconfig — **not** rslib's spawn-tsgo-to-temp approach.
- **`mergeApiModels`/`rewriteCanonicalReferences` (`merge-models.ts`)** — multi-entry merge, ported verbatim from rslib-builder, using hand-rolled JSON surgery rather than `@microsoft/api-extractor-model`. Keeps the main `.` entry canonical and rewrites sub-entry canonical references to `${packageName}/${subpath}!`.
- **`buildTsdocConfig`/`writeTsdocConfig` (`tsdoc-config.ts`)** — deterministic, idempotent `tsdoc.json` emission, standard tags populated from `@microsoft/tsdoc`'s `StandardTags`, behind a deep-equal write guard so an unchanged config is not rewritten.
- **`createMessageSuppressor` (`message-suppressor.ts`)** — an API Extractor message matcher (messageId exact-match AND optional regex/substring on the text, with a regex→substring fallback).
- **`normalizeMetaOptions` + types (`config.ts`)** — `MetaOptions`/`TsdocOptions`/`TsdocTagDefinition`/`WarningSuppressionRule`/`NormalizedMeta`.
- **`TsconfigResolver`/`resolvePortableTsconfig` (`tsconfig-resolver.ts`)** — ports rslib's tsconfig resolver via the TypeScript compiler API. `resolvePortableTsconfig(cwd, fallbackConfigPath?)` resolves the package's own `tsconfig.json` effective options (following `extends`, e.g. the shared `@savvy-web/bundler/ecma.json` base), falls back to the build's resolved dts tsconfig when the package has none, then to a minimal config; `TsconfigResolver.resolve` converts TS's internal enum/path representation back into a portable, JSON-serializable `PortableTsconfig` — compilerOptions-only, `$schema` added, enum values → strings, lib paths → short names, `composite: false`/`noEmit: true` forced, and all absolute-path/emit/file-selection options dropped. This is what makes the meta bundle a self-contained virtual TS env. `typescript` is therefore a direct runtime dependency of this package (see [Current State](#current-state)).

**Known limitation (verbatim parity port):** `rewriteCanonicalReferences` only walks `members`, not `excerptTokens[*].canonicalReference` or `references[*]`, so cross-entry `@link`s authored in a sub-entry may not be rewritten. This matches rslib-builder's behavior and is not fixed by Track A.

## The targets derivation

Track C added `src/targets/`, the **single source of truth for turning `publishConfig.targets` into the groups to build and the registry endpoints to publish them to** (spec §6.1). The bundler reads `publishConfig.targets`, calls `resolveTargets` and threads the result into the build loop and the binding artifact (see `../bundler/architecture.md`); the bundler owns no derivation logic. Track E (the release action) will consume the binding and may import `resolveTargets` directly.

`resolveTargets({ targets, baseName })` (`resolve-targets.ts`, pure) returns a `TargetResolution` of `{ groups, targets }`:

- **Groups are byte-variants.** Every `true` target collapses into ONE canonical base-name group (folder id `npm` if present, else the first true id). A string or object `name` override gets its own group (folder id = its key, manifest name = the override). A group `dir` is always `dist/prod/<id>/pkg`.
- **`from` reuses bytes.** An object target with `from: <id>` adds no new group — it binds a registry endpoint to a referenced group's already-built bytes. This is the N-Targets:1-TargetGroup relationship made declarative.
- **Default registries** fill in for the well-known keys (`npm` → `registry.npmjs.org`, `github` → `npm.pkg.github.com`); a custom key must supply `{ registry }`.
- **Structural validation throws `ConfigValidationError`** (`{ path, reason }`, the single typed error in `src/errors.ts`) for the invalid shapes: empty targets, `from`+`name` together, dangling/chained/self-referencing `from`, a custom key with no registry and `github: true` against an unscoped base name. `resolveTargets` is pure and throws synchronously outside the Effect boundary, but it throws the *typed* error (§8 made it the single source of truth — the verbatim reason strings are preserved); the `ConfigValidator` layer delegates target validation to it and re-surfaces the throw as a typed Effect failure. The exact case list lives in `resolve-targets.ts`.

`writeTargetsBinding(cwd, resolution)` (`binding.ts`) writes the `TargetResolution` to `dist/prod/targets.json` (tab-indented, trailing newline) and returns the path. This file is the bundler→release-action contract: it records which groups exist and which registry each target deploys to, so the release action uploads the built `dist/prod/<id>/pkg` bytes to the right endpoints without re-deriving anything. Both the front-door `runBuild` and the two self-hosting builders' escape-hatch `savvy.build.ts` call it on `--target prod` (the latter with `resolveTargets({ targets: { npm: true, github: true }, baseName: pkg.name })`), so every in-repo package emits a binding. (silk-effects consumes this binding at publish-target resolution time — see `../silk-effects/architecture.md`.)

## JSX resolution

Track D added `src/jsx/config.ts`, the **tsconfig→rolldown JSX mapping** so a `.tsx` package builds with the right runtime without per-package wiring. Two pure functions:

- **`resolveJsxConfig(tsconfig, override)`** maps a TS `compilerOptions.jsx` to the rolldown `JsxConfig` the build forwards: `react-jsx`/`react-jsxdev` → `{ runtime: "automatic", importSource: jsxImportSource ?? "react" }`, `react` → `{ runtime: "classic" }`, `preserve`/`react-native`/absent → `undefined` (nothing to configure). An explicit `override` wins (and the automatic-runtime importSource still defaults to `"react"`).
- **`readTsconfigJsx(cwd)`** is the best-effort inference source: it reads `<cwd>/tsconfig.json` `compilerOptions.jsx`/`jsxImportSource`, returning `{}` on absence or parse error.

The resolved `JsxConfig` flows two ways from the bundler: into the dts tsconfig (the `jsx`/`jsxImportSource` fields above) and into the build loop's `inputOptions.jsx`. Keeping the mapping here means the bundler only resolves *effective* jsx (override ?? inference) once and threads the result; see `../bundler/architecture.md`.

## The SEA exe-compile wrapper

Track B added `src/exe/`, the **interface-only wrapper over tsdown's exe (SEA) mode** for packages that ship a single-executable binary. Two units:

- **`normalizeExeOptions(exe, pkgOsCpu)` (`config.ts`, pure)** turns the `ExeConfig` (object or array) into one fully-resolved `NormalizedExe` per binary: entry defaults to `./src/bin.ts`; targets are inferred from the package's `os`/`cpu` when not stated (`win32` → the `win` token, `arm64`/`x64` only); `nodeVersion` defaults to `DEFAULT_EXE_NODE_VERSION`; `seaConfig` defaults `{ disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false }`. It does no structural validation — empty-fileName/empty-targets checks live in the config validator.
- **`runExeBuild(options)` (`build.ts`)** runs one tsdown build per spec in exe mode, `config: false`, `format: "esm"`, `platform: "node"`, with `deps.alwaysBundle = id => !id.startsWith("node:")` (a SEA must bundle every non-builtin import — nothing is resolvable from disk inside the binary). The tsdown `build` fn is injectable (a lazy `import("tsdown")` default), so this stays interface-only and unit-testable; `ExeBuild` is deliberately loose-typed (`config: unknown`) so no tsdown runtime type leaks in. The actual `@tsdown/exe` runtime dep lives on the *bundler*; tsdown lazily imports it when the exe option is used.

Real binary compilation is a CI/mac-runner manual step, out of the hermetic test suite; the in-repo tests inject a fake build and assert the spec/options.

## The config-validation service

§8 added `src/config-validation/`, the **fast-fail validator the bundler runs first** over the resolved config so a structurally-bad `savvy.build.ts` or `publishConfig.targets` fails before any build work across the dev/npm/meta/exe paths.

- **`ConfigValidator` (`ConfigValidator.ts`)** is a `Context.Tag` service with one method `validate(input: ValidationInput) → Effect<void, ConfigValidationError>`. `ValidationInput` is the normalized fact bundle the bundler assembles (baseName, `hasExports`, optional `targets`/`exe`/`osCpu`/`meta`).
- **`ConfigValidatorLive` (`ConfigValidatorLive.ts`)** is a `Layer.succeed` wrapping a **synchronous** `check` in `Effect.try`, surfacing the throw as a typed `ConfigValidationError` failure. The rules: targets are delegated to `resolveTargets` (single source of truth); exe is run through `normalizeExeOptions` then checked for empty fileName and empty targets; meta validates tsdoc `tagDefinitions` syntaxKind (`block`/`inline`/`modifier`) and that any existing `localPaths` are directories, gated behind a **prerequisite `!hasExports` cross-field guard** (a package with no exports cannot emit an api-model, so that fails fast first).

The validator is the bundler-facing entry point, but every individual rule reuses the same pure functions the build paths use (`resolveTargets`, `normalizeExeOptions`) — it adds the cross-field and presence checks, not a parallel rule set.

## The escape-hatch contract

A power user composes the same plugins by hand:

```ts
import { defineConfig } from "tsdown";
import { packageJsonEntries, emitManifest } from "@savvy-web/tsdown-plugins";

export default defineConfig({
  entry: packageJsonEntries(),
  plugins: [emitManifest({ /* ... */ })],
  // …override anything tsdown natively supports
});
```

Four guarantees hold this together: **parity** (the plugins *are* the front door's building blocks), **stability** (the plugin API in `src/index.ts` is the semver'd public surface, not leaked bundler internals), **interface-only coupling** (plugins target rolldown's plugin type with a documented compat range; the user brings their own tsdown) and **no second-class paths** (anything the orchestrator does that isn't a plugin — the multi-group loop — is still a helper, `buildTargetGroups`).

## Boundaries and Invariants

- **Interface-only to tsdown.** Type-only imports of rolldown's `Plugin`; the single `import("tsdown")` is lazy and injectable. No tsdown peer dependency.
- **No catalog-source logic.** `resolveManifest` delegates entirely to `workspaces-effect`'s `CatalogResolver`; the catalog error types are re-exported, not redefined.
- **Effect stays behind the boundary.** Plugin objects and `resolveManifest` are plain values/Promises; the reporter Effect is run by the consumer.
- **Entry rules and the bin leading-`./` strip are exact rslib parity** — they must not drift, since they determine output bytes and (for bins) npm-install correctness.
- **All meta behavior lives here.** `generateMeta` and its units own the API Extractor pipeline; the bundler only wires it. Meta runs over the emitted dev `.d.ts`, decoupled from the prod tsdown build.
- **`resolveTargets` is the single source of truth for the targets derivation.** The bundler and Track E both derive from it rather than reimplementing the `publishConfig.targets` → groups/targets mapping. The declarative rename (`base.name = targetGroup.name`) is the only mechanism that produces a renamed manifest variant.
- **`ConfigValidationError` is the single typed config error.** §8 made every structural-config guard (`resolveTargets`, the exe/meta checks, the cross-field rules) throw it rather than a plain `Error`; the `ConfigValidator` layer composes those same pure checks and re-surfaces the throw as a typed Effect failure.
- **The exe path keeps the interface-only boundary.** `runExeBuild` touches tsdown only through the injectable, loose-typed `ExeBuild` seam (lazy `import("tsdown")`); the `@tsdown/exe` runtime dep is the bundler's, not this package's.
- **Dual-format is derived from one source.** Everything cjs (output formats, `cjsDefault` interop, the manifest `require` condition) is gated on `format.includes("cjs")` and defaults off, so esm-only builds stay byte-identical. `fixedExtension` is the `false` literal and does not change for dual-format.
- **The build is two passes by default.** The JS pass owns the outDir (`clean: true`, `dts: false`, `unbundle: true`); the dts pass appends bundled declarations (`clean: false`, `emitDtsOnly: true`, `unbundle: false`). The dts pass's `clean: false` is load-bearing — it must not wipe the JS the first pass wrote. This is the default, not opt-in.
- **The dts pass posture mirrors the JS pass posture.** `bundleNodeModules` inlines node_modules types into the dts to match the self-contained JS bundle; `dtsExternals` is dts-pass-only (JS still bundles). The dts pass `neverBundle` is always the union of `externals` + `dtsExternals`; the JS pass carries `externals` only. Keeping the two postures consistent is what prevents a `.d.ts` referencing a type the runtime bundle inlined (or vice versa). See [Bundling posture](#bundling-posture-bundlenodemodules-bundle-bundledpackages-dtsexternals).
- **The entry namer is the single source of output basenames.** `createEntryName` is exported and reused by the manifest transform so the declared export path always matches the emitted file; `extractEntries` throws on a flatten collision rather than silently overwriting an entry.
- **The auto-version define key is `process.env.__PACKAGE_VERSION__`.** Both passes key it on the member expression consumers read (not the bare identifier, which never matched and shipped `0.0.0`); user `define` is merged after it so a same-named user key wins. `define` is build-level, shared by every entry partition. See [The define map and the version-key fix](#the-define-map-and-the-version-key-fix).
- **The `./package.json` self-export is auto-injected when exports exist.** `transformManifest` adds it before the user transform (which can strip it), only when an `exports` field is present, idempotently, promoting a bare-string exports to a `{ ".", "./package.json" }` map. See [Manifest emission](#manifest-emission-and-catalog-delegation).
- **`cjsDefaultInterop` is gated to cjs default+named ENTRY chunks** and runs in both build passes for dual-format builds (the dts pass re-emits the `.cjs`), but is a no-op everywhere else.
- **`nodeBuiltinDefaultInterop` rewrites default imports of node builtins to namespace form** before codegen (a rolldown 1.1.0 CJS-codegen defect fix). It is cjs-only, runs in both passes for dual-format builds and is a no-op for esm. See [The node-builtin default-interop plugin](#the-node-builtin-default-interop-plugin).
- **Per-entry overrides layer extra partitions into one outDir.** The base partition owns the outDir (`clean: true`); each override is `clean: false` and the base `entry` must exclude the overridden entries. The manifest is emitted once (base partition) with a `DualExports` Set when entries differ in format. A no-override build is byte-identical to the single-partition M3 loop. See [Per-entry format and bundling overrides](#per-entry-format-and-bundling-overrides).
- **tsdown auto-externalizes declared deps, so `externals` lists only the departures.** The default externalizes `dependencies`+`peerDependencies`+`optionalDependencies`; `externals` is for undeclared transitives that must stay external, and `bundle`/`bundleNodeModules` are for the inverse force-inline postures.
- **`defaultManifestTransform` is the strip default; `removeDeclarationMaps` strips prod dts maps.** The bundler applies the strip when no `transform` is supplied (a custom transform replaces and re-calls it) and strips declaration source-maps from each prod group after meta generation; dev keeps the maps.
- **Prod output is unminified by default.** `minify` applies to prod groups only and defaults off — this builder targets Node libraries where readable output is preferred over bundle size.
- **This package self-builds (M2).** It builds via an escape-hatch `savvy.build.ts` importing `buildTargetGroups` from its OWN `./src` (tsx-compiled, tier 1 of the bootstrap ladder); it no longer carries rslib. Its `ecma.json` tsconfig base is a synced local copy of the bundler's `public/ecma.json`, guarded by `__test__/ecma-sync.test.ts`. With M6, rslib is fully decommissioned from `systems` — all nine packages build via the bundler. See `../bundler/architecture.md`.
- **`src/index.ts` is the semver'd contract.** It is what the escape hatch and the bundler both depend on.

## Rationale

### Why interface-only, not a tsdown peer

A maintained peer on the bundler core is exactly the drift that triggered this program (rslib-builder's `@rslib/core` peer). Coupling to tsdown's plugin *type* with a documented compat range — and letting the bundler/escape-hatch user supply the runtime — keeps a tsdown upgrade a single bundler release rather than an ecosystem-wide peer bump.

### Why delegate catalog resolution to workspaces-effect

The original plan reproduced rslib's multi-source catalog merge here and shipped a silk-specific durable asset to fix the state-file ordering bug. `workspaces-effect@^1.2.0` shipped a generic, durable `CatalogResolver` that already solves it (with its own state-file-absent regression test), so this package wraps it in a few lines instead of owning the logic — deleting a milestone of cross-repo work. The trade is the `process.cwd()` workspace-discovery constraint documented above.

### Why copy the reporter instead of sharing

The vitest reporter pattern is proven but the SP1 `BuildReport` is intentionally simpler than vitest-agent's `AgentReport`. Owning the code now keeps the bundler shippable without coupling to an external reporter package's release cadence; a shared/extracted reporting package is a later consolidation if it earns its keep.
