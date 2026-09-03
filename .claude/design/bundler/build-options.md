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
  - ./meta-wiring.md
  - ./exe-wiring.md
  - ./self-hosting.md
  - ./tsconfig-preset.md
  - ../tsdown-plugins/architecture.md
  - ../silk/architecture.md
  - ../rspress-builder/architecture.md
dependencies:
  - ./architecture.md
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/bundler build options

The `defineBuild` option surface and how `runBuild` forwards each option into `@savvy-web/tsdown-plugins`' `buildTargetGroups`. Part of the [bundler architecture](./architecture.md); the mechanics behind every option live in `../tsdown-plugins/architecture.md`.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [Dual-format esm plus cjs](#dual-format-esm-plus-cjs)
- [Bundling-posture knobs](#bundling-posture-knobs)
- [Per-entry format and bundling overrides](#per-entry-format-and-bundling-overrides)
- [Loose files: standalone bundled outputs](#loose-files-standalone-bundled-outputs)
- [define and plugins](#define-and-plugins)
- [Manifest strip, minify and declaration-map defaults](#manifest-strip-minify-and-declaration-map-defaults)
- [emitDts: skipping declarations](#emitdts-skipping-declarations)
- [JSX](#jsx)
- [Ambient .d.ts exports](#ambient-dts-exports)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

Every option is pure wiring: `defineBuild` (`src/config.ts`) normalizes it, `runBuild` (`src/run.ts`) conditional-spreads it onto the `buildTargetGroups` call and `tsdown-plugins` owns the behavior. The one place the bundler does real work is resolving per-entry `overrides` into entry partitions before the build. `BuildConfigInput` in `src/config.ts` is the authoritative option list with per-field doc comments; this doc records why each knob exists and where it crosses the boundary.

## Current state

All options described here are implemented and exercised in-repo: silk is the dual-format/override consumer, `pnpm-plugin-silk` the loose-files consumer, `rspress-builder` the web-runtime override consumer and the bundler itself the ambient `.d.ts` consumer. Deferred: a collision guard between a loose file and a real export's emitted filename, and adding an ambient `outName` to a `files` allowlist (no in-repo package sets `files`).

## Dual-format esm plus cjs

`format?: ReadonlyArray<BuildFormat>` (`"esm" | "cjs"`) is forwarded as-is; `tsdown-plugins` defaults it to `["esm"]`. Adding `"cjs"` yields esm `.js` plus cjs `.cjs`, dual `import`/`require` export conditions in the emitted manifest, CJS named-export interop and a `.d.cts` declaration. The cjs-default-interop footer and the node-builtin default-interop rewrite are not knobs — they activate for any pass that emits `.cjs`. silk is the first real consumer (see `../silk/architecture.md`).

## Bundling-posture knobs

tsdown auto-externalizes `dependencies` + `peerDependencies` + `optionalDependencies`, so most packages carry no `externals` at all; `externals` names only undeclared transitives that must stay external. Four knobs cover the postures that depart from that default:

- **`bundleNodeModules`** force-bundles every node_modules/workspace dep not in `externals` into the output, and the dts pass inlines the matching types. It also switches the JS pass from per-module output to a single bundled file per entry, so the artifact survives `npm pack` (which strips any `node_modules`-named directory a per-module layout would emit). silk's and `@savvy-web/changelog`'s self-contained CJS-requireable artifacts depend on it.
- **`bundle`** force-inlines the listed packages into the JS output (tsdown `deps.alwaysBundle`), even declared deps — the inverse of `externals`. JS-pass only.
- **`bundledPackages`** inlines ONLY the listed packages' declarations into the bundled dts, externalizing the rest. JS-pass unaffected.
- **`dtsExternals`** externalizes the listed packages in the dts pass ONLY while the JS pass still bundles them per `bundleNodeModules`. For dependencies whose types cannot be inlined — silk lists `effect` here because its `declare module` augmentations inline into TS2320 conflicts in consumers.

## Per-entry format and bundling overrides

`overrides?: ReadonlyArray<BuildEntryOverride>` pins SOME export paths to their own format/bundling while the base build uses a different posture. This is silk's shape: base entries are ESM-only with silk-effects externalized, but `./changesets/markdownlint` is dual-format CJS force-bundling silk-effects. The partition loop lives in `tsdown-plugins`; the bundler resolves config into partitions.

- Each override lists `entries` (canonical export paths like `"./changesets/markdownlint"` or `"."`) plus its own optional format and posture knobs and the three web-runtime fields below. See `BuildEntryOverride` in `src/config.ts`.
- **`runBuild` resolves export paths to entry partitions.** It maps each export path through `createEntryName` to the build entry name, partitions the full entry map into a base set plus one `EntryOverride` per override, computes the `dualExports` Set (which export keys emit cjs, from the base format and each override's format) and threads them to `buildTargetGroups`. The base `entry` EXCLUDES the overridden entries.
- **Export paths must be canonical.** `runBuild` THROWS on a path missing the `./` prefix (it would flatten to a valid entry name and build, but its `dualExports` key would not match the manifest's export key and silently drop the `require` condition) and on a path that is not a build entry of the package.
- **The no-override path is unchanged.** With no `overrides`, `runBuild` passes the full entry map and no partitions.

### The web-runtime override fields (platform, css, outSubdir)

Three additive `BuildEntryOverride` fields let an override partition build a browser sub-bundle, used by `@savvy-web/rspress-builder` for an RSPress `./runtime` (see `../rspress-builder/architecture.md`).

- **`platform`** (`"node" | "browser" | "neutral"`, default node) sets the JS-pass platform for that partition; the dts pass stays node. **`css`** enables `@tsdown/css` on the JS pass.
- **`outSubdir`** builds BOTH passes of the partition into `<group>/pkg/<outSubdir>/` with the entry renamed to `index`, so the partition cannot collide with the base partition's per-file output and the barrel path is deterministic. `runBuild` THROWS if an `outSubdir` override pins more than one export path; `validateSubdirOverrides` runs that check on every target path, before any early return.
- **`subdirExports` is derived automatically** from the `outSubdir` overrides and threaded to `buildTargetGroups` so the manifest rewrites those keys to `<subdir>/index.{js,d.ts}`. The meta pass repoints the subdir's dts basename via `applySubdirMetaEntries` inside `runMetaPass` (see [Meta wiring](./meta-wiring.md)).

## Loose files: standalone bundled outputs

`looseFiles?: Record<string, string | LooseFileSpec>` emits one or more self-contained bundled files at literal paths inside the package dir, OUTSIDE the exports/dts/meta graph. The driver is pnpm **config dependencies** — packages that forbid runtime `dependencies` and resolve a `pnpmfile.mjs`/`pnpmfile.cjs` by filename at the package root — but it generalizes to any "emit this source as a standalone bundled file at this exact path + format".

- Keys are literal output filenames; values are a source path or `{ source, format }`. Format is INFERRED from the key extension (`.mjs` → esm, `.cjs` → cjs); `.js` requires an explicit `format`. Contradictions, path separators and unsupported extensions are `ConfigValidationError`s.
- `runBuild` threads `config.looseFiles` into `ConfigValidator.validate`, then calls `normalizeLooseFiles` once and forwards the descriptors.
- Each loose file inherits its build group's `externals`/`bundle`/`bundleNodeModules` posture, so pair it with `bundleNodeModules: true` for a self-contained pnpmfile.
- Loose files get no manifest `exports` entry, no `.d.ts` and no API model.

## define and plugins

- **`define`** forwards compile-time global replacements (`Record<string, string>`, values inserted verbatim so string literals must be pre-quoted). It is build-level — shared by every partition — and merged AFTER the auto-injected `process.env.__PACKAGE_VERSION__` key so a same-named user key wins. See the define-map section of `../tsdown-plugins/architecture.md`.
- **`plugins`** forwards custom rolldown plugins (the `Plugin` type, re-exported from `@savvy-web/bundler`) to EVERY tsdown run — the JS pass, the bundled-dts pass, the declarations pass and each loose-files pass — under the internal name `extraPlugins`. Plugins run after the builder's internal interop plugins and before its metrics instrumentation. The driver is build-time codegen / virtual modules: a consumer's loose-files `pnpmfile.ts` can import a virtual module that a config-dependency plugin serves via `resolveId`/`load`.
- **Why the bundler declares `rolldown` directly.** Because `BuildConfigInput.plugins` types as `ReadonlyArray<Plugin>` and `index.ts` re-exports `Plugin`, `rolldown` must be a direct dependency so the `Plugin` type tree stays an external `import("rolldown")` reference in the bundler's emitted `.d.ts`. Inlining it would drag in rolldown-internal symbols the entry point does not export, which API Extractor flags as `ae-forgotten-export` (a hard error under CI). This matters only for the bundler's self-build; a downstream package that merely passes `plugins` does not expose `Plugin` in its declarations.

## Manifest strip, minify and declaration-map defaults

- **`transform` defaults to `defaultManifestTransform`**, which strips build/dev-only manifest fields. A custom `transform` REPLACES the default, so a package with custom manifest work imports and calls `defaultManifestTransform` itself (re-exported from `@savvy-web/bundler`) to keep the strip.
- **`minify` defaults to `false` and applies to prod only.** This builder targets Node libraries where readable output is preferred — minification trips SCA scanners and degrades stack traces. Dev is never minified regardless.
- **Declaration source-maps are stripped from prod.** `runBuild` calls `removeDeclarationMaps` on each prod group's `pkg/` AFTER the meta pass has consumed the `.d.ts.map` files (API Extractor reads them; they are dead weight that leaks local paths in the tarball). Dev keeps them.

## emitDts: skipping declarations

`emitDts?: boolean` (default `true`) controls whether the bundled-dts pass runs at all, on dev and prod alike. `false` skips the dts pass, the prod declarations pass and therefore the meta pass (which has nothing to read), while still emitting JS, byte-variant folders, catalog resolution and the transformed manifest. It is orthogonal to `meta: false`, which disables only the API-model generation and keeps the dts pass. Intended for JS-only artifacts that never ship declarations (e2e fixtures, bins, internal tools), where skipping the TypeScript compiler load is a material per-build saving. It is named `emitDts` rather than `dts` to avoid confusion with tsdown's nested `dts` option object. `runBuild` treats `undefined` as `true` so a hand-authored `BuildConfig` need not supply it.

## JSX

A `.tsx` package builds with the right JSX runtime with zero extra config. `runBuild` computes `resolveJsxConfig(readTsconfigJsx(cwd), config.jsx)` once — an explicit `defineBuild({ jsx })` wins, else the runtime is inferred from the package's own `tsconfig.json` `compilerOptions.jsx`. The resolved value flows ONLY into the generated dts tsconfig (`writeResolvedTsconfig({ jsx, jsxImportSource })`), which both passes consume; it is deliberately not forwarded as a rolldown input option, which tsdown rejects. The mapping itself lives in `tsdown-plugins`' `src/jsx/`.

## Ambient .d.ts exports

A package can declare a types-only export whose source is a hand-authored declaration file (a bare `.d.ts` string or `{ types: "*.d.ts" }`); the build rewrites the manifest pointer and copies the file verbatim with no custom `transform` or copy script. The classification, manifest rewrite AND the copy live in `tsdown-plugins` inside `buildTargetGroups`, so the self-hosting escape hatches get the copy too; the bundler's role is early validation.

- `runBuild` calls `extractAmbientDts(...)` (throws on a mixed export) and `assertNoEntryCollisions(entries, ambient)` right after entry derivation, so a bad ambient export fast-fails on every target path. Both the entry map and the ambient set derive from the injectable `exportsMap` (`=== pkg.exports` in production) so tests can fake exports without a real `package.json`.
- A types-only package (ambient exports only, no JS entry, no exe) is rejected with a `ConfigValidationError` — a package must ship at least one JS or exe entry alongside its declarations.
- **The bundler dogfoods this.** `src/env.d.ts` declares `process.env.__PACKAGE_VERSION__` (the auto-injected `define` key) as an optional `NodeJS.ProcessEnv` member and publishes as the ambient `./env` export, so a consumer pulls it in via `/// <reference types="@savvy-web/bundler/env" />`. `@savvy-web/rspress-builder` ships the identical pattern for its own `./env`.

## Boundaries and invariants

- **Every option is pure wiring** onto `buildTargetGroups`; the behavior — posture mirrors, interop plugins, partition loop, loose-file passes, define merge, four-pass plugin spread, ambient copy — is `tsdown-plugins`'.
- **Per-entry overrides are resolved in `runBuild`, not the build loop**, and a non-canonical or non-existent export path throws.
- **`externals` lists only departures** from tsdown's auto-externalize default.
- **Defaults strip and unminify.** `transform` defaults to `defaultManifestTransform`, `minify` defaults off, prod declaration maps are stripped after meta.
- **`emitDts: false` disables dts and meta together**; `meta: false` disables meta alone.

## Rationale

### Why the knobs mirror rslib's postures

The bundler replaced an rslib-based builder whose consumers had settled on a handful of bundling postures (externalize everything, bundle everything except externals, selective dts inlining). Exposing those postures as explicit knobs let every package migrate without changing its published artifact shape, while the default (auto-externalize declared deps, per-module output, bundled dts) stays the zero-config path.

### Why overrides partition entries rather than configure per-file

Partitioning keeps the common case byte-identical and confines the complexity to the packages that need mixed formats. Resolving partitions in `runBuild` rather than inside the loop keeps the loop a plain helper the escape hatch can call with pre-built partitions.
