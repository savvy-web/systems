---
status: current
module: rspress-builder
category: architecture
created: 2026-06-13
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 95
related:
  - ../bundler/architecture.md
  - ../tsdown-plugins/architecture.md
dependencies:
  - ../bundler/architecture.md
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/rspress-builder architecture

A thin sibling to `@savvy-web/bundler` that builds RSPress plugin packages — the one capability the bundler does not model. It presets a dual-bundle build (a Node plugin entry plus an isolated browser CSS-module React runtime entry) and otherwise reuses the bundler's orchestration verbatim.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The dual-bundle model](#the-dual-bundle-model)
- [definePlugin](#defineplugin)
- [build](#build)
- [Why the runtime is an isolated subdir](#why-the-runtime-is-an-isolated-subdir)
- [The peer-dependency contract](#the-peer-dependency-contract)
- [The shipped consumer presets](#the-shipped-consumer-presets)
- [API model covers options and components](#api-model-covers-options-and-components)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/rspress-builder` owns no build logic. `definePlugin(options?)` assembles a standard `BuildConfig` (the bundler's `defineBuild` shape) with the RSPress runtime baked in as a `BuildEntryOverride` partition. `build(options?, overrides?)` is the consumer front door — it applies `definePlugin` and calls the bundler's `runBuild`; `definePlugin` and `runBuild` remain exported as primitives for callers that compose them directly. The shared machinery — the override-partition loop, the two-pass build, the meta pipeline, the targets derivation — lives in `@savvy-web/bundler` and `@savvy-web/tsdown-plugins`; this package only presets the rspress-specific knobs and points there.

**Package:** `packages/rspress-builder`. **Source:** `src/index.ts` is the whole public surface and is authoritative for the option types (`RspressPluginOptions`, `RspressBundleOptions`) and their defaults — this doc records intent, not the field list. The package self-hosts via its own `savvy.build.ts` through the bundler's front-door `build()` (tier 3 of the bootstrap ladder — see [the bundler's bootstrap ladder](../bundler/self-hosting.md#the-bootstrap-ladder)).

The reference consumer is `spencerbeggs/rspress-plugin-api-extractor`, outside this repo.

## Current state

`definePlugin` and `build` are implemented and threaded end to end, including the three web-runtime override fields the runtime partition rides. The package ships its consumer presets (`./tsconfig/plugin.json`, `./tsconfig/ecma.json`), the ambient `./env` types-only export and a merged API model covering both entries. Coverage lives in `packages/rspress-builder/__test__/` (the preset shape, the `build` front door, the public assets and the `ecma.json` byte-identity guard) with the runtime partition's emit, externals and `import.meta.env` behavior covered by the bundler's integration fixtures. Link-and-build validation against a real RSPress site happens in the reference consumer, outside this repo.

## The dual-bundle model

An RSPress plugin package is a dual-bundle package the general-purpose Node-library bundler does not express:

- **Plugin entry (`.`)** — Node target, bundled JS, bundled `.d.ts`, contributes the plugin-factory/options API model. `@rspress/core` stays external.
- **Runtime entry (`./runtime`)** — browser target, **bundleless** (per-file) JS with CSS modules, React (`react` and its JSX runtimes), `@rspress/core` and `@theme` externalized, `import.meta.env` preserved. Built into an isolated `runtime/` subdir.

`definePlugin` expresses the runtime as a single override partition for the `./runtime` export using the three web-runtime override fields — `outSubdir: "runtime"`, `platform: "browser"` and a `css` block with camelCase-only CSS modules and `inject: true` — plus the runtime externals. The base (plugin) partition keeps the default node posture with `@rspress/core` externalized. The partition mechanics live in [web-runtime partitions](../tsdown-plugins/build-loop.md#web-runtime-partitions) and [the web-runtime override fields](../bundler/build-options.md#the-web-runtime-override-fields-platform-css-outsubdir).

**CSS auto-load rides `inject: true`.** tsdown's default CSS-module output exports the locals map but does not re-import the emitted `.css`, so styles would not load. `@tsdown/css`'s `inject: true` makes the emitted CSS-module JS side-effect-import its stylesheet, so a consumer importing a runtime component pulls in its CSS automatically.

## definePlugin

`definePlugin(options)` returns a `BuildConfig`, so `runBuild` consumes it with no change to its invocation contract. Internally it:

- presets the plugin externals (`@rspress/core` plus build-wide `externals` plus any `plugin.externals`, deduped);
- builds the runtime override partition when `runtime !== false` (`true` or an `RspressBundleOptions` object enables it; `false` disables it — it does NOT auto-detect the filesystem, so a runtime-less plugin must pass `false`);
- sets the `define` identity map `{ "import.meta.env": "import.meta.env" }` so RSPress resolves `SSG_MD` per site build, with the user's `define` merged after it so a user key may intentionally override;
- forwards `meta`, `bundledPackages`, `dtsExternals`, `bundleNodeModules`, `transform` and `jsx` under the bundler's own option names, unchanged.

**Dependency posture resolves per bundle, with per-bundle tuning winning over the build-wide value.** The plugin (`.`) bundle IS the base build, so `options.plugin` resolves directly against the build-wide value inside `definePlugin`. The runtime bundle is a separate override partition, and **the bundler's partitions do NOT inherit from the base build** — an option a partition omits is simply absent for it. So `definePlugin` threads `runtimeTuning.<field> ?? options.<field>` onto the runtime override explicitly for `bundledPackages`, `dtsExternals` and `bundleNodeModules`. Only `externals` is additive across both bundles: build-wide values merge into both partitions' own lists rather than being an override target. `define` is build-wide because the bundler has no per-bundle define.

## build

`build(options?, overrides?)` calls `runBuild(definePlugin(options), ...)`, deriving `cwd` from the invoking script's directory and `argv` from the process arguments, with `overrides` layered on top. A plugin author's `savvy.build.ts` is therefore a single awaited call — `import { build } from "@savvy-web/rspress-builder"; await build()` — with no default export or `import.meta.main` gate, mirroring the bundler's own `build()` DX.

## Why the runtime is an isolated subdir

The load-bearing architectural decision. A runtime partition sharing the base `pkg/` outDir, distinguished only by `platform`/`css`, is unsafe for two reasons shown empirically:

1. **Collision** — any module reachable by BOTH the plugin and the runtime emits to the same `pkg/` path under the two-pass `clean: false` layering, so the second (browser) build silently overwrites the first (node) build with wrong-platform output.
2. **Drift** — the runtime barrel's output path is computed from its import graph, so the `./runtime` manifest target could silently move.

`outSubdir: "runtime"` removes both: both passes of the runtime partition emit into `<group>/pkg/runtime/`, with the partition's single barrel entry named `index`. Modules the runtime reaches from outside `src/runtime/` land under `pkg/runtime/<rel>/…`, never colliding with the plugin's root-level output, and the barrel is always `pkg/runtime/index.js` so the manifest maps `./runtime` → `./runtime/index.js` deterministically. The subdir-path threading through the manifest and meta lives in `../tsdown-plugins/architecture.md` and `../bundler/architecture.md`.

## The peer-dependency contract

The React/RSPress contract is kept entirely out of the core Node-library bundler via peer dependencies on this package: `@rspress/core`, `react`, `react-dom`, plus `typescript` and the `@types/*` entries. `@tsdown/css` is NOT a peer — it is a regular dependency here, so a consumer never installs it explicitly; tsdown lazily loads it only when a CSS file is encountered (and throws a guard error if it is missing), which keeps it out of the core bundler without making it a consumer obligation.

The only runtime dependency on the suite is `@savvy-web/bundler`. `@savvy-web/tsdown-plugins` is a **devDependency** — this package's emitted `.d.ts` names no tsdown-plugins type directly, and the reference that does exist resolves for consumers through the bundler's own regular dependency on it. Do not promote it. See `packages/rspress-builder/package.json` for the authoritative split.

## The shipped consumer presets

The package ships two consumer-facing tsconfig presets from top-level `public/` (mirrored into the published `pkg/` and exported under the `tsconfig/` namespace) plus one ambient `.d.ts` export sourced from `src/`:

- **`./tsconfig/plugin.json`** (`public/tsconfig/plugin.json`) — the RSPress plugin SOURCE preset for the plugin package itself: JSX automatic, `es2025` + `dom` lib, `react`/`react-dom` types. It is **fully inlined, with no `extends` at all**. This is the in-repo instance of the taxonomy's self-containment rule (see [Self-containment](../bundler/tsconfig-preset.md#self-containment-shipped-presets-extend-only-relative-files)): TypeScript `extends` REPLACES array-valued options (`types`/`lib`) rather than merging them, so a preset that itself extends another preset compounds that replace-semantics risk on every consumer that then extends IT. Inlining collapses the chain to zero hops for its consumers.
- **`./tsconfig/ecma.json`** (`public/ecma.json`) — a byte-identical copy of the bundler's canonical `packages/bundler/public/tsconfig/ecma.json`, for a consumer that wants the plain Node-library base rather than the RSPress preset. It lives at `public/ecma.json`, deliberately outside the auto-formatted `public/tsconfig/`, so Biome key-sorting cannot break the byte-identity guard in `__test__/ecma-sync.test.ts`.
- **`./env`** — ambient `*.module.css`/`*.css` module declarations plus the `ImportMetaEnv`/`ImportMeta` typings (`SSG_MD`, `SSR`, `MODE` and the rest). Sourced from `src/env.d.ts` as a types-only `{ types: "..." }` export via tsdown-plugins' ambient-`.d.ts`-export machinery (see [Ambient .d.ts exports](../tsdown-plugins/entry-and-manifest.md#ambient-dts-exports)), not the `public/` mirror. The declarations are global-script augmentations with no `declare global` wrapper — that wrapper is illegal in a global script (TS2669), and under `skipLibCheck` the error is suppressed while the augmentation is silently discarded, leaving consumers with no `import.meta.env` at all. `@savvy-web/bundler` ships the identical `./env` pattern for its own `process.env.__PACKAGE_VERSION__` key; a consumer pulls either in via `/// <reference types="..." />`.

## API model covers options and components

The meta pipeline merges API models across entries, so the plugin (`.`) entry contributes the plugin-factory/options model and `./runtime` contributes the component/prop-type model; they merge into one `.api.json` that flows to the mcp/website API-doc tier like every other package. The only meta wiring is that the runtime dts lives at the subdir path `runtime/index.d.ts`, so the meta pass points the `./runtime` meta entry at the `runtime/index` dts basename (`applySubdirMetaEntries` in `@savvy-web/tsdown-plugins`' `runMetaPass` — see [the meta-generation pipeline](../tsdown-plugins/meta.md#the-pipeline)). The runtime's API model is deliberately NOT disabled, which is what makes plugin options AND components both documentable.

## Boundaries and invariants

- **The builder owns no build behavior.** `definePlugin` only presets knobs on a standard `BuildConfig`; every behavior is a `@savvy-web/bundler`/`@savvy-web/tsdown-plugins` helper. `build()` is a thin wrapper that applies `definePlugin` and delegates to `runBuild`.
- **The runtime is an isolated subdir, not a shared-outDir partition.** `outSubdir: "runtime"` makes plugin↔runtime collisions structurally impossible and the `./runtime` manifest path deterministic. See [Why the runtime is an isolated subdir](#why-the-runtime-is-an-isolated-subdir).
- **`runtime` is explicit, not filesystem-detected.** A plugin with no runtime must pass `runtime: false`.
- **The React/RSPress contract is peer-only; the CSS one is not.** `@rspress/core`/`react`/`react-dom` are peers of this package and never reach the core bundler. `@tsdown/css` is a regular dependency here, lazily loaded by tsdown when CSS is encountered.
- **The shipped presets use no `extends` at all.** A consumer's own `extends` is the only hop. That sidesteps two hazards at once: a transitive bundler specifier cannot be resolved by tsdown's tsconfig loader, and each `extends` hop compounds the array-replace semantics of `types`/`lib`. The byte-identical `ecma.json` copy is guarded by `__test__/ecma-sync.test.ts`.
- **The runtime's API model is enabled.** Both entries merge into one `.api.json`.
- **No sass.** lightningcss-backed `@tsdown/css` is sufficient for the reference consumer; sass is a non-goal until a real consumer needs it.

## Rationale

### Why a separate package, not a bundler option

The RSPress dual-bundle contract pulls in React, `@tsdown/css` and `@rspress/core` — dependencies that have no place in a general-purpose Node-library bundler. Splitting them into a thin sibling keeps those dependencies and the rspress-specific presets out of the core bundler while reusing all of its orchestration. The bundler stayed RSPress-agnostic; it only carries the three additive override fields the runtime partition needs (browser platform, CSS, isolated subdir), which are generic enough to serve any future web-runtime sub-package.

### Why reuse runBuild verbatim

`build()` calls `runBuild(definePlugin(options), ...)` so the `node savvy.build.ts --target {dev|prod|meta|exe}` semantics, the dev/prod/meta contract and the publishing outputs are inherited unchanged — the Silk release pipeline builds and ships an RSPress plugin exactly like every other Silk package, with no special-casing.
