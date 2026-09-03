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
  - ./build-loop.md
  - ./dts-emission.md
  - ./dual-format.md
  - ../bundler/architecture.md
  - ../rspress-builder/architecture.md
---

# Entry detection and manifest emission

How a package's `exports`/`bin` become tsdown entries, how the published `package.json` is derived from the source manifest, how a hand-authored `.d.ts` export ships, and where catalog resolution is delegated. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Entry detection](#entry-detection)
- [Ambient .d.ts exports](#ambient-dts-exports)
- [Manifest emission](#manifest-emission)
- [Catalog delegation](#catalog-delegation)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

Three modules cooperate: `src/entry/` derives the entry map and classifies declaration-file exports, `src/manifest/` holds the pure manifest transforms and the one rolldown plugin (`emitManifest`) that writes the published `package.json`, and `src/catalog/` wraps the `@effected` kit's catalog resolver in a Promise. The load-bearing link between them is the shared entry namer: the manifest rewrite derives every built path from the same `createEntryName` the entry extractor uses, so the declared export path always matches the file tsdown emits.

## Current state

- **Entry:** `extractEntries`/`createEntryName` (`src/entry/extract.ts`) and the tsdown-facing `packageJsonEntries` (`src/entry/package-json-entries.ts`).
- **Ambient declarations:** `classifyDtsExport`/`extractAmbientDts`/`ambientOutName`/`assertNoEntryCollisions` (`src/entry/ambient-dts.ts`), the verbatim `copyAmbientDts` (`src/build/sync-public.ts`) and the relative-specifier guard `findRelativeSpecifiers` (`src/dts/relative-imports.ts`).
- **Manifest:** `transformManifest`/`transformExports`/`transformBin`/`normalizeBinPaths`/`defaultManifestTransform` (`src/manifest/transform.ts`); the `emitManifest` plugin and `buildEmittedManifest` (`src/manifest/emit-manifest.ts`).
- **Catalog:** `resolveManifest` and the locally owned `ManifestLike` boundary type (`src/catalog/resolve-catalogs.ts`); the catalog error classes are `@effected/npm` re-exports from `src/index.ts`.

## Entry detection

`extractEntries` derives the tsdown `entry` map from `exports` and `bin`: it resolves each export value to its TypeScript source and names the entry through `createEntryName` (`.` → `index`, otherwise the key flattened with `/` → `-`). These rules are core identity — they determine the output bytes and the declared export paths — so `src/entry/extract.ts` is authoritative for the exact rule set and the `exportsAsIndexes`/`bin` variants. `packageJsonEntries` wraps it into the `Record<name, path>` tsdown accepts.

**The slash-to-dash flatten is not injective, so `extractEntries` throws on collision.** `./a-b/c` and `./a/b-c` both flatten to `a-b-c`; a silent overwrite would corrupt one entry and its manifest target, so the extractor fails loudly naming both keys. This is what makes silk's nested subpath exports safe under the flat output scheme.

**Declaration files are pass-through assets, never buildable entries.** Both the `isTypeScriptFile` guard in `extract.ts` and the `isTs` guard in `manifest/transform.ts` exclude `.d.ts`/`.d.cts`/`.d.mts`. Two disjoint shapes exist, decided by where the declaration path sits. A **`.d.ts`-keyed** export (the key itself is the published filename, e.g. `"./types.d.ts": "./public/types.d.ts"`) is a public-asset re-export: it ships verbatim via the `public/` sync and keeps its literal manifest target. A **`.d.ts`-valued** export (a normal subpath key whose source is a declaration file) is *ambient* and handled below. No in-repo package uses the keyed form today; it remains supported and both `extractAmbientDts` and `transformExports` explicitly skip it so the two shapes stay disjoint.

## Ambient .d.ts exports

A types-only export whose source is a hand-authored declaration — a bare `.d.ts` string or `{ types: "*.d.ts" }` — is rewritten in the published manifest and copied verbatim into every target dir, with no custom `transform` and no post-build copy step. `@savvy-web/rspress-builder`'s `./env` export is the in-repo consumer (see `../rspress-builder/architecture.md`).

- **`classifyDtsExport` is the single discriminator** — `ambient`, `mixed` (a declaration `types` alongside a compilable runtime condition) or `none`. `extractAmbientDts` and `transformExports` both use it, so the manifest rewrite and the copy never disagree about what is ambient.
- **Output naming derives from the export key, not the source path.** `ambientOutName` runs the key through `createEntryName` and appends the source's preserved declaration extension, so `"./virtual": { types: "./src/virtual.d.ts" }` publishes as `{ types: "./virtual.d.ts" }` at `<pkg>/virtual.d.ts`. A types-only export never gains an `import`/`require` condition, even under dual format.
- **Three cases throw `ConfigValidationError` rather than degrade.** A `mixed` export (`mixedDtsExportError` — the build generates types from the runtime source, so hand-authored `types` cannot coexist). A relative `import`/`export`/`import()`/`/// <reference path>` in the copied source (`findRelativeSpecifiers`, an AST parse — a verbatim copy to the flattened package root cannot resolve relative neighbors). A missing source. The structural checks and `assertNoEntryCollisions` (ambient-vs-JS-entry and ambient-vs-ambient name collisions) run during extraction; the filesystem and relative-specifier checks run in `copyAmbientDts`.
- **The copy runs inside `buildTargetGroups`**, once per group alongside `copyPublicDir`, so every build path — the front door and both self-hosting escape hatches — copies its ambient exports. The bundler's `runBuild` only runs the early extraction as fast-fail validation. See [The build loop](./build-loop.md#the-public-sync).

## Manifest emission

`emitManifest` is the one rolldown plugin: in `generateBundle` it reads the source `package.json`, builds the transformed manifest via `buildEmittedManifest`, emits it as `package.json` into the output `pkg/` and copies `LICENSE`/`README.md`. The pipeline, in order: resolve catalogs (prod, or dev when `devManifest: "resolve"`) → apply the declarative rename (`base.name = targetGroup.name`) → strip `publishConfig`/`scripts` and set `private` from `publishConfig.access` → rewrite `exports`/`bin`/`types` to built paths → inject the `./package.json` self-export → run the user `transform({ pkg, targetGroup })` → strip leading `./` from bin paths as the final guard (npm silently drops `./`-prefixed bins) → sort keys via `@effected/package-json`. See `src/manifest/transform.ts` for the mechanics.

- **The declarative rename is load-bearing for ordering.** The rename happens after the catalog resolve and before the user transform, so the user transform and the emitted manifest both observe the renamed package. This is how a `github` or string-override group emits a differently named manifest — distinct publishable bytes — without per-group transform code. `TargetGroupRef` carries `name` alongside `id`/`isProd` for this reason.
- **The export-path rewrite derives the built basename from the entry name.** `transformExports` maps each export key through `createEntryName` (`./changesets/markdownlint` → `changesets-markdownlint.js`), so the declared `import`/`types`/`require` target always matches the flattened file tsdown emits. Keying off the source path would produce wrong nested subpaths for packages like silk.
- **The TS-export conditions are shaped by three build-level facts** threaded from `buildTargetGroups` into `transformExports`: `DualExports` (a boolean or a `ReadonlySet` of export keys that gain a `require` condition — see [Dual-format output](./dual-format.md)), `subdirExports` (keys built into `<entry>/index.*` — see [The build loop](./build-loop.md#web-runtime-partitions)) and `emitDts` (`false` omits the `types` condition on every generated export, because the manifest must not point at a `.d.ts` that was never written). An `exeRewrite` additionally repoints the exe entry's export/bin value at the emitted SEA binary (see [The SEA exe wrapper](./exe.md)).
- **The `./package.json` self-export is auto-injected.** `transformManifest` adds `"./package.json": "./package.json"` so consumers can `import "name/package.json"`. It runs only when an `exports` field is present (a package with no exports already exposes everything), before the user transform (which may strip it), idempotently, and it decides whether to wrap a bare-string `exports` into a map from the *original* exports type, because after `transformExports` a bare string is indistinguishable from a conditions map.
- **`defaultManifestTransform` is the strip every package would otherwise hand-write.** It deletes the build/dev-only fields (`devDependencies`, `scripts`, `publishConfig` and the like); the bundler's `defineBuild` applies it as the default `transform`. A custom `transform` *replaces* it, so a package doing genuinely custom manifest work (silk's dependency pruning, the two self-hosting builders) imports and calls it itself to keep the strip.

## Catalog delegation

`resolveManifest` does not reimplement `catalog:`/`workspace:` resolution. It decodes the manifest via `@effected/npm`'s `Manifest.decode`, short-circuits when nothing needs resolution and otherwise hands it to `@effected/workspaces`' one-shot `Workspaces.resolveManifest`, which assembles the workspace's complete pnpm catalog set (inline `pnpm-workspace.yaml`, config-dependency hook replay and lockfile) without depending on the transient `.pnpm-workspace-state-v1.json`. It runs on a bound-once `NodeFileSystem`/`NodePath` platform layer.

Two consequences shape the callers. The one-shot API re-discovers the workspace root from `process.cwd()`, so `resolveManifest` must run from inside the target workspace — catalogs are workspace-wide, so any cwd inside it yields the same set. And `buildEmittedManifest` only resolves when `targetGroup.isProd || devManifest === "resolve"`, so a `dev` group with the default `devManifest: "preserve"` keeps `catalog:`/`workspace:` specifiers intact for injected dev packages to resolve through the workspace. The prefix test itself is delegated too: `emit-manifest.ts` uses `DependencySpecifier.isCatalog`/`isWorkspace`, not hand-rolled `startsWith` checks.

The re-exported error surface is the kit's: `ManifestDecodeError`, `UnresolvedDependencyError` (carrying a structured `reason`), `CatalogAssemblyError` and `DependencyResolutionError`. This package defines no catalog error twins.

## Boundaries and invariants

- **Entry rules and the bin leading-`./` strip must not drift** — they determine output bytes and, for bins, npm-install correctness.
- **`createEntryName` is the single source of output basenames**, shared by the extractor and the manifest transform; `extractEntries` throws on a flatten collision rather than overwriting.
- **The declarative rename (`base.name = targetGroup.name`) is the only mechanism that produces a renamed manifest variant.**
- **Declaration-file exports are never built.** A `.d.ts`-keyed export is a public-asset passthrough; a `.d.ts`-valued export is ambient (rewrite + verbatim copy off one classifier, throwing `ConfigValidationError` on mixed, colliding or relatively-importing sources).
- **No catalog-source logic lives here.** Resolution and its errors are `@effected/npm` + `@effected/workspaces`; only `ManifestLike` is locally owned, as the public boundary type.

## Rationale

### Why delegate catalog resolution to the kit

A self-owned catalog merge would have to reproduce pnpm's multi-source catalog assembly and durably work around the `.pnpm-workspace-state-v1.json` ordering bug. `@effected/workspaces` solves it generically, so this package wraps it in a few lines instead of owning the logic. The trade is the `process.cwd()` workspace-discovery constraint above, and one definition per failure mode instead of local error twins that only re-wrapped the resolver's own errors.

### Why the manifest keys off the entry name

The published manifest and the emitted files come from two different code paths (the transform and tsdown), and the only thing keeping them in agreement is that both derive the basename from the same function. Exporting `createEntryName` and reusing it in `transformExports` is cheaper than any after-the-fact reconciliation, and it is the reason nested subpath exports work at all under a flat output layout.
