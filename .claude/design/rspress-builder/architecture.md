---
status: current
module: rspress-builder
category: architecture
created: 2026-06-13
updated: 2026-06-18
last-synced: 2026-06-18
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
- [Why the runtime is an isolated subdir](#why-the-runtime-is-an-isolated-subdir)
- [The peer-dependency contract](#the-peer-dependency-contract)
- [The shipped consumer presets](#the-shipped-consumer-presets)
- [API model covers options and components](#api-model-covers-options-and-components)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/rspress-builder` owns no build logic. `definePlugin(options?)` assembles a standard `BuildConfig` (the bundler's `defineBuild` shape) with the RSPress runtime baked in as an `EntryOverride` partition, and the package re-exports the bundler's `runBuild` so a consumer imports both from one source. The shared machinery — the `EntryOverride` partition loop, the two-pass build, the meta pipeline, the targets derivation — lives in `@savvy-web/bundler` and `@savvy-web/tsdown-plugins`; this package only presets the rspress-specific knobs and points there.

**Package:** `@savvy-web/rspress-builder`, at `packages/rspress-builder` in `savvy-web/systems`. **Source:** `src/index.ts` (the whole public surface). It self-hosts via its own front-door `savvy.build.ts` (`defineBuild`/`runBuild`, tier 3 of the bundler bootstrap ladder — see `../bundler/architecture.md`).

The reference consumer is `spencerbeggs/rspress-plugin-api-extractor`, whose migration off rslib is the proof but lives outside this repo.

## Current State

`definePlugin` and the three additive partition fields it rides (`platform`/`css`/`outSubdir`, all in `tsdown-plugins`' `EntryOverride`) are implemented and threaded end to end. The package ships its consumer presets under the `tsconfig/` namespace (`./tsconfig/plugin.json`, `./tsconfig/ecma.json`, plus the ambient `./rspress-env.d.ts`) and a merged API model covering both entries. The runtime partition's browser/bundleless/CSS-module emit, externals, `import.meta.env` preservation and the bundled-dts-plus-merged-api-model are covered by bundler integration fixtures plus this package's unit tests. The reference-consumer migration and link-and-build validation against a real RSPress site are the outstanding proof, tracked outside this repo.

The option surface is deliberately small and defined in `src/index.ts` (the `RspressPluginOptions`/`RspressBundleOptions` types); that file is authoritative for the exact shape — this doc documents intent, not the field list.

## The dual-bundle model

An RSPress plugin package is a dual-bundle package the general-purpose Node-library bundler does not express:

- **Plugin entry (`.`)** — Node target, bundled JS, bundled `.d.ts`, contributes the plugin-factory/options API model. `@rspress/core` stays external.
- **Runtime entry (`./runtime`)** — browser target, **bundleless** (per-file) JS with CSS modules, `react`/`react/jsx-runtime`/`react/jsx-dev-runtime`/`@rspress/core`/`@theme` externalized, `import.meta.env` preserved. Built into an isolated `runtime/` subdir.

`definePlugin` builds the runtime as a single `EntryOverride` partition for the `./runtime` export with `outSubdir: "runtime"`, `platform: "browser"`, `css: { modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true }` and the runtime externals. The base (plugin) partition keeps the default node posture with `@rspress/core` externalized. See the partition mechanics in `../tsdown-plugins/architecture.md`.

**CSS auto-load rides `inject: true`.** tsdown's default CSS-module output exports the camelCase→hashed locals map but does not re-import the emitted `.css`, so styles would not load. `@tsdown/css`'s `inject: true` makes the emitted CSS-module JS side-effect-import its stylesheet, reproducing the rslib output contract; a consumer importing the runtime component pulls in its CSS automatically.

## definePlugin

`definePlugin(options)` returns a `BuildConfig`, so `runBuild` consumes it with no change to its invocation contract. The consumer's `savvy.build.ts` is the standard self-executing shape (`definePlugin(...)` → default export → `import.meta.main` gate calling the re-exported `runBuild`). Internally `definePlugin`:

- presets the plugin externals (`@rspress/core` plus any `plugin.externals`);
- builds the runtime `EntryOverride` partition when `runtime !== false` (`true`/`{ externals }` enables it; `false` disables it — it does NOT auto-detect the filesystem, so a runtime-less plugin must pass `false`);
- sets the `define` identity map `{ "import.meta.env": "import.meta.env" }` (merged before user `define`) so RSPress resolves `SSG_MD` per site build;
- forwards `apiModel` → bundler `meta` (so the per-prod-group meta emission and the `optimistic` next-version rewrite apply to an RSPress plugin unchanged), `dtsBundledPackages` → `bundledPackages`, plus `transform`/`jsx`.

`define` is build-wide (the bundler has no per-bundle define); the user merge happens after the identity map. See `src/index.ts` for the exact options and defaults.

## Why the runtime is an isolated subdir

The load-bearing architectural decision. The runtime was originally going to be a plain `EntryOverride` sharing the base `pkg/` outDir, distinguished only by `platform`/`css`. Two empirical builds showed that is unsafe:

1. **Collision** — any module reachable by BOTH the plugin and the runtime emits to the same `pkg/` path under the two-pass `clean: false` layering, so the second (browser) build silently overwrites the first (node) build with wrong-platform output.
2. **Drift** — the runtime barrel's output path is computed from its import graph, so the `./runtime` manifest target could silently move.

The rslib builder avoided both by building the runtime into an isolated `dist/<mode>/runtime/` directory with a pinned base. `outSubdir: "runtime"` reproduces that on tsdown: both passes of the runtime partition emit into `<group>/pkg/runtime/`, with the partition's single barrel entry named `index`. Modules the runtime reaches from outside `src/runtime/` land under `pkg/runtime/<rel>/…`, never colliding with the plugin's root-level output, and the barrel is always `pkg/runtime/index.js` so the manifest maps `./runtime` → `./runtime/index.js` deterministically. The `platform`/`css` fields landed first (additive, backward-compatible); `outSubdir` is the correction that makes the dual-bundle safe. The subdir-path threading through the manifest and meta lives in `../tsdown-plugins/architecture.md` and `../bundler/architecture.md`.

## The peer-dependency contract

The React/CSS/RSPress contract is kept entirely out of the core Node-library bundler via peer dependencies on this package: `@rspress/core`, `react`, `react-dom` and `@tsdown/css`. tsdown lazily loads `@tsdown/css` only when a CSS file is encountered (and throws a guard error if it is missing), so it is a peer of the rspress plugin package, never a hard dep of the bundler. `definePlugin` depends on `@savvy-web/bundler` (for `runBuild`/`defineBuild`) and `@savvy-web/tsdown-plugins` (for the partition types). See `packages/rspress-builder/package.json` for the dependency split.

## The shipped consumer presets

The package ships three consumer-facing assets under top-level `public/` (mirrored into the published `pkg/` and exported), all under the `tsconfig/` export namespace except the ambient declaration:

- **`./tsconfig/plugin.json`** — the RSPress plugin SOURCE preset for the plugin package itself (JSX automatic, `es2025`+`dom` lib, `react`/`react-dom` types). Self-contained: it **extends the colocated synced `../ecma.json`** (a relative `./` file), NOT `@savvy-web/bundler/ecma.json`. An external consumer has the bundler only transitively, and tsdown's tsconfig-`extends` loader cannot resolve a package-extends into a transitive dependency — so this package keeps a byte-identical copy of the bundler's `public/ecma.json` and exports its own `./tsconfig/ecma.json`. An `ecma-sync.test.ts` guards the copy against drift (the same pattern `tsdown-plugins` uses — see `../bundler/architecture.md`). It was renamed this branch from the former bare `./tsconfig.json`; unreleased, so no alias.
- **`./tsconfig/ecma.json`** — the synced byte-identical copy of the bundler's `public/ecma.json` (resolved from its own `public/ecma.json`, deliberately outside the auto-formatted `public/tsconfig/` so Biome key-sorting cannot break the byte-identity guard).
- **`./rspress-env.d.ts`** — ambient `*.module.css`/`*.css` module declarations plus the `ImportMetaEnv`/`ImportMeta` typings (replacing the rslib-era `@rslib/core/types` reference).

## API model covers options and components

The meta pipeline merges API models across entries, so the plugin (`.`) entry contributes the plugin-factory/options model and `./runtime` contributes the component/prop-type model; they merge into one `.api.json` that flows to the mcp/website API-doc tier like every other package. The only meta wiring is that the runtime dts lives at the subdir path `runtime/index.d.ts`, so the meta pass points the `./runtime` meta entry at the `runtime/index` dts basename (see `applySubdirMetaEntries`, now in `@savvy-web/tsdown-plugins`' `runMetaPass` — `../tsdown-plugins/architecture.md`). The single divergence from the rslib builder: the runtime's API model is NOT disabled (rslib set `apiModel: false` for it), which is what makes plugin options AND components both documentable.

## Boundaries and Invariants

- **The builder owns no build behavior.** `definePlugin` only presets knobs on a standard `BuildConfig`; every behavior is a `@savvy-web/bundler`/`@savvy-web/tsdown-plugins` helper. `runBuild` is re-exported unchanged.
- **The runtime is an isolated subdir, not a shared-outDir partition.** `outSubdir: "runtime"` makes plugin↔runtime collisions structurally impossible and the `./runtime` manifest path deterministic. See [Why the runtime is an isolated subdir](#why-the-runtime-is-an-isolated-subdir).
- **`runtime` is explicit, not filesystem-detected.** A plugin with no runtime must pass `runtime: false`.
- **The React/CSS/RSPress contract is peer-only.** `@rspress/core`/`react`/`react-dom`/`@tsdown/css` are peers of this package and never reach the core bundler; `@tsdown/css` is lazily loaded by tsdown.
- **The shipped presets are self-contained — they extend the synced LOCAL `../ecma.json`, not the bundler specifier.** A transitive bundler dependency cannot be resolved by tsdown's tsconfig loader; the byte-identical local copy is guarded by `ecma-sync.test.ts`. See the taxonomy in `../bundler/architecture.md`.
- **The runtime's API model is enabled.** Both entries merge into one `.api.json`, so plugin options and runtime components are both documented.
- **No sass.** lightningcss-backed `@tsdown/css` is sufficient for the reference consumer; sass is a non-goal until a real consumer needs it.

## Rationale

### Why a separate package, not a bundler option

The RSPress dual-bundle contract pulls in React, `@tsdown/css` and `@rspress/core` — dependencies that have no place in a general-purpose Node-library bundler. Splitting them into a thin sibling keeps those peers and the rspress-specific presets out of the core bundler while reusing all of its orchestration. The bundler stayed RSPress-agnostic; it only grew the three additive `EntryOverride` fields the runtime partition needs, which are generic enough (browser platform, CSS, isolated subdir) to serve any future web-runtime sub-package.

### Why reuse runBuild verbatim

Because `definePlugin` returns a normal `BuildConfig` with the runtime baked in as an override partition, the `node savvy.build.ts --target {dev|prod|meta|exe}` semantics, the dev/prod/meta contract and the publishing outputs are inherited unchanged — so the Silk release pipeline builds and ships an RSPress plugin exactly like every other Silk package, with no special-casing.
