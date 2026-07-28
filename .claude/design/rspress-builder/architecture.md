---
status: current
module: rspress-builder
category: architecture
created: 2026-06-13
updated: 2026-07-27
last-synced: 2026-07-27
completeness: 90
related:
  - ../bundler/architecture.md
  - ../tsdown-plugins/architecture.md
dependencies:
  - ../bundler/architecture.md
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/rspress-builder architecture

A thin sibling to `@savvy-web/bundler` that builds RSPress plugin packages — the one capability the bundler did not model. It presets a dual-bundle build (a Node plugin entry plus an isolated browser CSS-module React runtime entry) and otherwise reuses the bundler's orchestration verbatim. It is the tsdown-based replacement for the rslib `RSPressPluginBuilder`.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The dual-bundle model](#the-dual-bundle-model)
- [definePlugin](#defineplugin)
- [build](#build)
- [Why the runtime is an isolated subdir](#why-the-runtime-is-an-isolated-subdir)
- [The peer-dependency contract](#the-peer-dependency-contract)
- [The shipped consumer presets](#the-shipped-consumer-presets)
- [API model covers options and components](#api-model-covers-options-and-components)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/rspress-builder` owns no build logic. `definePlugin(options?)` assembles a standard `BuildConfig` (the bundler's `defineBuild` shape) with the RSPress runtime baked in as an `EntryOverride` partition. `build(options?, overrides?)` is the consumer front door — it applies `definePlugin` internally and calls the bundler's `runBuild`; `definePlugin` and `runBuild` remain exported as underlying primitives for advanced use. The shared machinery — the `EntryOverride` partition loop, the two-pass build, the meta pipeline, the targets derivation — lives in `@savvy-web/bundler` and `@savvy-web/tsdown-plugins`; this package only presets the rspress-specific knobs and points there.

**Package:** `@savvy-web/rspress-builder`, at `packages/rspress-builder` in `savvy-web/systems`. **Source:** `src/index.ts` (the whole public surface). It self-hosts via its own `savvy.build.ts` using the bundler's `build()` function (tier 3 of the bundler bootstrap ladder — see `../bundler/architecture.md`).

The reference consumer is `spencerbeggs/rspress-plugin-api-extractor`, whose migration off rslib is the proof but lives outside this repo.

## Current State

`definePlugin` and the three additive partition fields it rides (`platform`/`css`/`outSubdir`, all in `tsdown-plugins`' `EntryOverride`) are implemented and threaded end to end. The package ships its consumer presets under the `tsconfig/` namespace (`./tsconfig/plugin.json`, `./tsconfig/ecma.json`) plus the ambient `./env` types-only export (`import.meta.env`/CSS-module declarations) and a merged API model covering both entries. The runtime partition's browser/bundleless/CSS-module emit, externals, `import.meta.env` preservation and the bundled-dts-plus-merged-api-model are covered by bundler integration fixtures plus this package's unit tests. The reference-consumer migration and link-and-build validation against a real RSPress site are the outstanding proof, tracked outside this repo.

The option surface is deliberately small and defined in `src/index.ts` (the `RspressPluginOptions`/`RspressBundleOptions` types); that file is authoritative for the exact shape — this doc documents intent, not the field list.

## The dual-bundle model

An RSPress plugin package is a dual-bundle package the general-purpose Node-library bundler does not express:

- **Plugin entry (`.`)** — Node target, bundled JS, bundled `.d.ts`, contributes the plugin-factory/options API model. `@rspress/core` stays external.
- **Runtime entry (`./runtime`)** — browser target, **bundleless** (per-file) JS with CSS modules, `react`/`react/jsx-runtime`/`react/jsx-dev-runtime`/`@rspress/core`/`@theme` externalized, `import.meta.env` preserved. Built into an isolated `runtime/` subdir.

`definePlugin` builds the runtime as a single `EntryOverride` partition for the `./runtime` export with `outSubdir: "runtime"`, `platform: "browser"`, `css: { modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true }` and the runtime externals. The base (plugin) partition keeps the default node posture with `@rspress/core` externalized. See the partition mechanics in `../tsdown-plugins/architecture.md`.

**CSS auto-load rides `inject: true`.** tsdown's default CSS-module output exports the camelCase→hashed locals map but does not re-import the emitted `.css`, so styles would not load. `@tsdown/css`'s `inject: true` makes the emitted CSS-module JS side-effect-import its stylesheet, reproducing the rslib output contract; a consumer importing the runtime component pulls in its CSS automatically.

## definePlugin

`definePlugin(options)` returns a `BuildConfig`, so `runBuild` consumes it with no change to its invocation contract. A plugin author's `savvy.build.ts` is a single awaited call — `import { build } from "@savvy-web/rspress-builder"; await build()` — with no default export or `import.meta.main` gate; the `build()` front door applies `definePlugin` internally before delegating to the bundler's `runBuild`. Internally `definePlugin`:

- presets the plugin externals (`@rspress/core` plus build-wide `options.externals` plus any `plugin.externals`, deduped);
- builds the runtime `EntryOverride` partition when `runtime !== false` (`true`/a `RspressBundleOptions` object enables it; `false` disables it — it does NOT auto-detect the filesystem, so a runtime-less plugin must pass `false`);
- sets the `define` identity map `{ "import.meta.env": "import.meta.env" }` (merged before user `define`) so RSPress resolves `SSG_MD` per site build;
- forwards `meta`, `bundledPackages`, `dtsExternals`, `bundleNodeModules`, plus `transform`/`jsx` **using the bundler's own option names unchanged** (renamed this branch from the former `apiModel`/`dtsBundledPackages` aliases, which diverged from the bundler's `BuildConfigInput` for no reason).

**`bundledPackages`/`dtsExternals`/`bundleNodeModules` resolve per bundle, with per-bundle tuning winning over the build-wide value.** The plugin (`.`) bundle IS the base build, so its tuning (`options.plugin`) resolves directly against `options.<field>` in `definePlugin` itself. The runtime bundle is a separate `EntryOverride` partition, and **the bundler's partitions do NOT inherit from the base build** — an option a partition omits is simply absent for it, never inherited from the base build (see `../bundler/architecture.md` and `../tsdown-plugins/architecture.md`'s `EntryOverride` docs). So `definePlugin` threads `runtimeTuning.<field> ?? options.<field>` onto the runtime override explicitly for each of the three fields; only `externals` is additive across both bundles (build-wide values merge into both partitions' own lists rather than being an override target). A stale doc comment on `EntryOverride` claiming inheritance was corrected in source this same branch — see `../tsdown-plugins/architecture.md`.

`define` is build-wide (the bundler has no per-bundle define); the user merge happens after the identity map. See `src/index.ts` for the exact options and defaults.

## build

`build(options?, overrides?)` is the consumer front door exported from `@savvy-web/rspress-builder`. It calls `runBuild(definePlugin(options), { cwd: dirname(process.argv[1]), argv: process.argv.slice(2) })`, so a plugin author's `savvy.build.ts` is a single awaited call with no boilerplate. `definePlugin` and `runBuild` are still exported as underlying primitives for callers that need to compose them directly.

## Why the runtime is an isolated subdir

The load-bearing architectural decision. The runtime was originally going to be a plain `EntryOverride` sharing the base `pkg/` outDir, distinguished only by `platform`/`css`. Two empirical builds showed that is unsafe:

1. **Collision** — any module reachable by BOTH the plugin and the runtime emits to the same `pkg/` path under the two-pass `clean: false` layering, so the second (browser) build silently overwrites the first (node) build with wrong-platform output.
2. **Drift** — the runtime barrel's output path is computed from its import graph, so the `./runtime` manifest target could silently move.

The rslib builder avoided both by building the runtime into an isolated `dist/<mode>/runtime/` directory with a pinned base. `outSubdir: "runtime"` reproduces that on tsdown: both passes of the runtime partition emit into `<group>/pkg/runtime/`, with the partition's single barrel entry named `index`. Modules the runtime reaches from outside `src/runtime/` land under `pkg/runtime/<rel>/…`, never colliding with the plugin's root-level output, and the barrel is always `pkg/runtime/index.js` so the manifest maps `./runtime` → `./runtime/index.js` deterministically. The `platform`/`css` fields landed first (additive, backward-compatible); `outSubdir` is the correction that makes the dual-bundle safe. The subdir-path threading through the manifest and meta lives in `../tsdown-plugins/architecture.md` and `../bundler/architecture.md`.

## The peer-dependency contract

The React/RSPress contract is kept entirely out of the core Node-library bundler via peer dependencies on this package: `@rspress/core`, `react`, `react-dom`, plus `typescript` and the `@types/*` entries. `@tsdown/css` is NOT a peer — it is a regular `dependencies` entry here, so a consumer never installs it explicitly; tsdown lazily loads it only when a CSS file is encountered (and throws a guard error if it is missing), which keeps it out of the core bundler without making it a consumer obligation.

Runtime dep is `@savvy-web/bundler` alone (for `runBuild`/`defineBuild`). `@savvy-web/tsdown-plugins` supplies the partition types but is a **devDependency** — this package's emitted `.d.ts` names no tsdown-plugins type directly, and the reference that does exist resolves for consumers through the bundler's own regular dependency on it. See `packages/rspress-builder/package.json` for the authoritative split.

## The shipped consumer presets

The package ships two consumer-facing tsconfig presets under top-level `public/` (mirrored into the published `pkg/` and exported under the `tsconfig/` namespace) plus one ambient `.d.ts` export sourced from `src/`:

- **`./tsconfig/plugin.json`** — the RSPress plugin SOURCE preset for the plugin package itself (JSX automatic, `es2025`+`dom` lib, `react`/`react-dom` types). It was renamed this branch from the former bare `./tsconfig.json`; unreleased, so no alias. **It is now FULLY INLINED, with no `extends` at all** — it used to `extends: "../ecma.json"`, but this branch expanded every `ecma.json` compilerOption directly into `plugin.json` and dropped the `extends` key. This is the concrete, in-repo instance of the taxonomy's self-containment rule (see [Self-containment](../bundler/architecture.md#self-containment-shipped-presets-extend-only-relative-files)): TypeScript `extends` REPLACES array-valued options (`types`/`lib`) rather than merging them, so a preset that itself extends another preset compounds that replace-semantics risk on every consumer that then extends IT — a two-hop `extends` chain makes reasoning about the effective `types`/`lib` list materially harder. Inlining `plugin.json` collapses that chain to zero hops for its own consumers. `./tsconfig/ecma.json` is still kept and exported separately (the synced byte-identical copy below) for a consumer that wants the plain Node-library base rather than the RSPress preset.
- **`./tsconfig/ecma.json`** — the synced byte-identical copy of the bundler's `public/ecma.json` (resolved from its own `public/ecma.json`, deliberately outside the auto-formatted `public/tsconfig/` so Biome key-sorting cannot break the byte-identity guard).
- **`./env`** — ambient `*.module.css`/`*.css` module declarations plus the `ImportMetaEnv`/`ImportMeta` typings (replacing the rslib-era `@rslib/core/types` reference). Sourced from `src/env.d.ts` as an ambient `{ types: "..." }` export (tsdown-plugins' ambient-`.d.ts`-export machinery — see `../tsdown-plugins/architecture.md#ambient-dts-exports`), not the `public/` mirror. This branch replaced the former public-asset `"./rspress-env.d.ts": "./public/rspress-env.d.ts"` **KEYED** export (a `.d.ts`-keyed passthrough, not ambient — see the KEYED-vs-VALUED distinction in `../tsdown-plugins/architecture.md`) with this ambient form; the old export string is gone with no alias (unreleased). A `declare global` wrapper that used to sit around the module augmentations was removed in the same move — illegal in a global script (TS2669), and under `skipLibCheck` the error is suppressed while the augmentation is silently discarded, so consumers had NO `import.meta.env` at all under the old form. `@savvy-web/bundler` ships the identical `./env` pattern for its own build-injected `process.env.__PACKAGE_VERSION__` key (see `../bundler/architecture.md`); a consumer pulls either in via `/// <reference types="..." />`.

## API model covers options and components

The meta pipeline merges API models across entries, so the plugin (`.`) entry contributes the plugin-factory/options model and `./runtime` contributes the component/prop-type model; they merge into one `.api.json` that flows to the mcp/website API-doc tier like every other package. The only meta wiring is that the runtime dts lives at the subdir path `runtime/index.d.ts`, so the meta pass points the `./runtime` meta entry at the `runtime/index` dts basename (see `applySubdirMetaEntries`, now in `@savvy-web/tsdown-plugins`' `runMetaPass` — `../tsdown-plugins/architecture.md`). The single divergence from the rslib builder: the runtime's API model is NOT disabled (rslib set `apiModel: false` for it), which is what makes plugin options AND components both documentable.

## Boundaries and Invariants

- **The builder owns no build behavior.** `definePlugin` only presets knobs on a standard `BuildConfig`; every behavior is a `@savvy-web/bundler`/`@savvy-web/tsdown-plugins` helper. `build()` is a thin convenience wrapper that applies `definePlugin` and delegates to the bundler's `runBuild`; both `definePlugin` and `runBuild` are re-exported as underlying primitives.
- **The runtime is an isolated subdir, not a shared-outDir partition.** `outSubdir: "runtime"` makes plugin↔runtime collisions structurally impossible and the `./runtime` manifest path deterministic. See [Why the runtime is an isolated subdir](#why-the-runtime-is-an-isolated-subdir).
- **`runtime` is explicit, not filesystem-detected.** A plugin with no runtime must pass `runtime: false`.
- **The React/RSPress contract is peer-only; the CSS one is not.** `@rspress/core`/`react`/`react-dom` are peers of this package and never reach the core bundler. `@tsdown/css` is a regular dependency here, not a peer — lazily loaded by tsdown when CSS is encountered, so it stays out of the bundler without becoming a consumer obligation.
- **The shipped presets are self-contained — they use no `extends` at all.** `plugin.json` formerly extended the synced local `../ecma.json`; this branch inlined every option and dropped the key, so a consumer's own `extends` is the only hop. That also sidesteps two hazards at once: a transitive bundler specifier cannot be resolved by tsdown's tsconfig loader, and each `extends` hop compounds the array-replace semantics of `types`/`lib`. The byte-identical `ecma.json` copy is still shipped separately and guarded by `ecma-sync.test.ts`. See the taxonomy in `../bundler/architecture.md`.
- **The runtime's API model is enabled.** Both entries merge into one `.api.json`, so plugin options and runtime components are both documented.
- **No sass.** lightningcss-backed `@tsdown/css` is sufficient for the reference consumer; sass is a non-goal until a real consumer needs it.

## Rationale

### Why a separate package, not a bundler option

The RSPress dual-bundle contract pulls in React, `@tsdown/css` and `@rspress/core` — dependencies that have no place in a general-purpose Node-library bundler. Splitting them into a thin sibling keeps those dependencies and the rspress-specific presets out of the core bundler while reusing all of its orchestration. The bundler stayed RSPress-agnostic; it only grew the three additive `EntryOverride` fields the runtime partition needs, which are generic enough (browser platform, CSS, isolated subdir) to serve any future web-runtime sub-package.

### Why reuse runBuild verbatim

`build()` calls `runBuild(definePlugin(options), ...)` so the `node savvy.build.ts --target {dev|prod|meta|exe}` semantics, the dev/prod/meta contract and the publishing outputs are inherited unchanged — the Silk release pipeline builds and ships an RSPress plugin exactly like every other Silk package, with no special-casing.
