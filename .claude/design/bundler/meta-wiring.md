---
status: current
module: bundler
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./architecture.md
  - ./build-options.md
  - ./self-hosting.md
  - ../tsdown-plugins/architecture.md
  - ../tsdown-plugins/meta.md
  - ../tsdown-plugins/report.md
dependencies:
  - ./architecture.md
  - ../tsdown-plugins/architecture.md
  - ../tsdown-plugins/meta.md
---

# @savvy-web/bundler meta wiring

When and where the API-model (meta) pass runs, and the bundler's one piece of meta-adjacent code: the `./og` Open Graph renderer. Part of the [bundler architecture](./architecture.md); the pipeline itself — API Extractor, the bundle trio, the optimistic version rewrite, the forgotten-export escalation, the `tsdoctor.json` sidecar — lives in [Meta generation](../tsdown-plugins/meta.md).

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [Meta runs inside --target prod](#meta-runs-inside---target-prod)
- [The meta option](#the-meta-option)
- [What runBuild threads in](#what-runbuild-threads-in)
- [The og subpath](#the-og-subpath)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

The bundler is pure wiring over `@savvy-web/tsdown-plugins`' meta surface. The orchestration is `runMetaPass` — a single tsdown-plugins helper that derives export paths, filters `bin/` entries, repoints `outSubdir` dts basenames, resolves optimistic next-versions and loops `generateMeta` once per prod group. The front door (`src/run.ts`) and both self-hosting escape hatches call the SAME helper; the bundler only decides *when* (inside `--target prod`) and *where* (per group into `dist/prod/<group>/meta`, the canonical group also into `localPaths`).

## Current state

Implemented, including the `tsdoctor.json` sidecar threading and the `@savvy-web/bundler/og` subpath (`src/og.ts`, tested in `__test__/og.test.ts`). `--target meta` is a deprecated warn-and-no-op kept so external escape-hatch scripts that still pass it do not hard-fail. Known limitation: `deriveExportPaths` handles plain string exports only; conditional (object-valued) exports fall through to a heuristic. No in-repo package uses conditional exports.

## Meta runs inside --target prod

`runBuild` calls `runMetaPass` after `buildTargetGroups` and before `removeDeclarationMaps`, on `--target prod` only, when `meta !== false`, `emitDts !== false` and the package has JS entries (an exe-only package has no dts to read).

- **Why prod, not dev.** The dev build keeps `catalog:`/`workspace:*` specifiers (`devManifest: "preserve"`); the prod manifest is catalog-resolved. Generating meta against `dist/prod/<group>/pkg/package.json` ships downstream Twoslash/API-doc consumers a working virtual TS environment.
- **Every prod group gets a `meta/` bundle**, each generated against its own `pkg` so the `.api.json` and bundle `package.json` carry that group's package name. Only the **canonical** group — the one whose resolved name matches the package, else the first — copies its bundle into `meta.localPaths`.
- **Meta reads already-emitted output and never re-bundles.** It runs API Extractor over each group's bundled `.d.ts` (and the prod-only `declarations/` tree, emitted because `runBuild` passes `emitDeclarations: true` on prod) and reads the catalog-resolved manifest. No tsdown build re-runs.
- **Ordering.** `removeDeclarationMaps` runs AFTER the meta pass because API Extractor needs the `.d.ts.map` files to resolve original-source positions.

## The meta option

`meta?: MetaOptions | false` is tri-state. Omitted → meta runs with default options; an object → overrides (`localPaths`, `tsdoc`, `optimistic`, `tsdoctor`); `false` → skip. `runMetaPass` normalizes `config.meta ?? {}` itself. `optimistic: "auto"` (the default) resolves to `false` under CI and `true` locally, so a local bundle forward-looks pending changeset versions while the CI release build does not; the rewrite touches the META bundle only, never the published `pkg/package.json`. See [Build options](./build-options.md) for the related `emitDts` knob.

`meta.tsdoctor` (`TsdoctorMetaOptions`, re-exported from `@savvy-web/bundler` alongside `OgImageInfo`) is the CONFIG tier of the meta bundle's `tsdoctor.json` sidecar — display `name`/`tagline`/`description`, `openGraph.{images, themeColor, generate}` and `registries` (or `false`). It is passed through untouched; the tier ranking, the source-file tiers, registry derivation and the sidecar's emission rules are all tsdown-plugins' (see [The tsdoctor.json sidecar](../tsdown-plugins/meta.md#the-tsdoctorjson-sidecar)). The bundler contributes only the default `openGraph.generate` implementation, below.

## What runBuild threads in

`runBuild` passes `runMetaPass` the resolved groups, the entry map, the exports map, `config.overrides` (so `outSubdir` partitions are repointed to `<subdir>/index`), the shared `BuildCollector` (diagnostics route into the unified log and `issues.json`), a `ci` flag resolved from `CI`/`GITHUB_ACTIONS` and `resolution.targets` — the `TargetResolution` the prod build already computed from `publishConfig.targets`, which the sidecar filters per group to derive each group's registry links (the target `id`, e.g. `npm`/`github`, becomes the registry label). Both self-hosting `savvy.build.ts` escape hatches thread the same `resolution.targets` (see [Self-hosting](./self-hosting.md)); an escape-hatch build that passes none simply derives no registries. Under CI a forgotten export is a hard failure (it corrupts the generated API model); locally it stays a warning. `RunOptions.generateMeta` and `RunOptions.resolveNextVersions` are the injectable seams.

`run.ts` also imports `deriveExportPaths` itself to compute the per-entry export-key map the override-partition `dualExports` derivation needs.

## The og subpath

`@savvy-web/bundler/og` (`src/og.ts`, a plain string export in the manifest) exports `ogImage.satori(options?)`, a factory returning the `(info: OgImageInfo) => Promise<Uint8Array>` that `meta.tsdoctor.openGraph.generate` expects. It renders the default card — project name in the accent color, the package's display name, tagline (falling back to description), then `<packageName>@<version>` — as a 1200×630 PNG. `SatoriOgOptions` is the palette: `accent`, `background`, `foreground`, each with a default.

- **Renderers are OPTIONAL peers.** `satori` (element tree → SVG) and `@resvg/resvg-js` (SVG → PNG) are `peerDependencies` marked optional and dynamic-imported on the first render, so a build that never generates an image never loads or needs them. A missing peer rejects with a message naming both packages, which `writeGeneratedOgImage` wraps as `OgGenerateError`.
- **The font ships with the package.** `public/assets/Inter-SemiBold.ttf` (SIL OFL 1.1, `LICENSE-Inter.txt` beside it) reaches the built `pkg/assets/` through the existing `copyPublicDir` sync. `og.ts` resolves it relative to `import.meta.url` by trying two candidates — `./assets/` for the built layout where `og.js` sits beside `assets/`, `../public/assets/` for the source layout — and throws if neither exists.
- **It is a subpath, not part of the root export.** Keeping the renderer out of `.` means the main entry's declarations never reference `satori`/`resvg` types, and the optional peers stay invisible to a consumer that only builds.

```ts
import { defineBuild } from "@savvy-web/bundler";
import { ogImage } from "@savvy-web/bundler/og";

export default defineBuild({
  meta: { tsdoctor: { tagline: "Every shape", openGraph: { generate: ogImage.satori() } } },
});
```

## Boundaries and invariants

- **All meta behavior lives in tsdown-plugins.** `runMetaPass`/`generateMeta`/`resolveNextVersions`/`deriveExportPaths`/`applySubdirMetaEntries` are tsdown-plugins exports; the front door and both escape hatches call the same `runMetaPass`.
- **Meta runs over already-emitted prod `.d.ts`, never dev, never re-bundling.**
- **`--target meta` is a no-op.** Meta is a function of `--target prod`.
- **The optimistic rewrite never touches the published manifest.**
- **The sidecar's config tier passes through verbatim; the bundler owns only the `./og` renderer**, which is an opt-in subpath over optional peers.
- **`resolution.targets` is threaded on every prod path** — front door and both escape hatches — so registry derivation is identical across them.

## Rationale

### Why a shared helper rather than an inline block

The bundler's `runBuild` and the two self-hosting escape hatches all need the identical meta orchestration. Owning it once in `tsdown-plugins` means the self-builds are API-Extractor validated exactly like front-door packages, and the bundler's "owns no build behavior" invariant holds for meta too.

### Why the OG renderer lives in the bundler, behind optional peers

The sidecar contract (`OgImageInfo → bytes`) belongs in tsdown-plugins so any generator can satisfy it, but a working default needs a rasterizer, a layout engine and a font — heavy, native-binding dependencies that no build should pay for unless it asks. Putting the default in the bundler (the package a config already imports) as an opt-in subpath with lazily-imported optional peers gives the zero-config path a one-line `ogImage.satori()` while leaving every other build byte-identical.

### Why meta moved out of a standalone target

A standalone `--target meta` ran against the dev output and copied an unresolved `package.json` into `localPaths`, breaking every downstream consumer that tried to rehydrate the package's types. Tying meta to the prod build fixed that at the root and let the root `build:prod` turbo task take `.changeset/**` as an input so a local changeset edit recomputes the optimistic meta.
