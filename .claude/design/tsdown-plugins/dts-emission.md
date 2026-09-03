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
  - ./meta.md
  - ./dual-format.md
  - ../bundler/architecture.md
  - ../e2e/architecture.md
---

# Declaration emission

How the dts pass compiles: the resolved tsconfig it runs under, the TypeScript 6 pin, why declarations are rolled up one entry at a time, the re-export stub, JSX runtime resolution and the declaration source-map stripper. Part of the [tsdown-plugins architecture](./architecture.md); the pass structure itself is in [The build loop](./build-loop.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The resolved dts tsconfig](#the-resolved-dts-tsconfig)
- [The TypeScript 6 pin](#the-typescript-6-pin)
- [Per-entry rollups and determinism](#per-entry-rollups-and-determinism)
- [The re-export stub](#the-re-export-stub)
- [JSX resolution](#jsx-resolution)
- [The declaration source-map stripper](#the-declaration-source-map-stripper)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

The cardinal decision: **tsdown native dts on the tsc path, not `isolatedDeclarations`.** rolldown-plugin-dts falls back to the TypeScript compiler for emit, driven by a tsconfig this package derives from the package's own `tsconfig.json` and writes to the OS temp dir. Bundled, self-contained declarations are the default output, emitted one entry at a time for byte-determinism.

## Current state

- **Resolved tsconfig:** `buildResolvedTsconfig`/`writeResolvedTsconfig`/`writeDtsEmitTsconfig` (`src/dts/resolved-tsconfig.ts`).
- **Re-export stub:** `analyzeReexportBarrel`/`collectExportNames`/`renderReexportStub` (`src/dts/reexport-stub.ts`), applied inside `buildTargetGroups`.
- **Relative-specifier guard:** `findRelativeSpecifiers` (`src/dts/relative-imports.ts`), used by the ambient `.d.ts` copy.
- **JSX:** `resolveJsxConfig`/`readTsconfigJsx` (`src/jsx/config.ts`).
- **Map stripper:** `removeDeclarationMaps` (`src/build/strip-maps.ts`).
- **`typescript`** is a runtime dependency pinned `^6.0.3` directly (not `catalog:silk`). Its only importers are the two AST readers in `src/dts/`; API Extractor bundles its own compiler.

## The resolved dts tsconfig

`buildResolvedTsconfig` resolves the package's own `tsconfig.json` through `@effected/tsconfig-json`'s `TsconfigLoaderSync` (tsc-parity `extends` merging, `${configDir}` substitution, absolute paths) and overlays the dts-pass deltas — see `DTS_OVERLAY` in the source — so the declaration program runs under the package's real `target`/`module`/`strict`/`lib`, not TypeScript defaults. `include`/`exclude` are deliberately *not* taken from the resolved config: the shared base pulls in `__test__` and `lib` sources, which have no business in a declaration program, so a narrow dts-specific list is held fixed. `writeResolvedTsconfig` writes the result to a temp file whose path the orchestrator passes to tsdown's `dts.tsconfig`. Optional `jsx`/`jsxImportSource` overrides ride on top so the dts compiler sees the same JSX runtime the build does.

**Absence and breakage are handled oppositely, on purpose.** A package with no `tsconfig.json` is a supported case (the e2e `leaf`/`leaf-escape` fixtures build without one) and gets synthesized defaults. A config that *exists* but will not resolve — malformed JSON, an `extends` that cannot be located — throws with package context. Falling back there would emit declarations compiled under the wrong options while reporting a green build, because the temp tsconfig never references the broken source. `resolvePortableTsconfig` (see [Meta generation](./meta.md)) throws on the same failure; the two must not diverge.

**The emit passes run on a `stableTypeOrdering` variant.** `writeDtsEmitTsconfig` derives a sibling temp tsconfig that `extends` the resolved one by absolute path and adds `stableTypeOrdering: true`; `buildTargetGroups` uses it for the dts and declarations emit passes only. TypeScript otherwise orders union/type members by internal type-ID encounter order, so an Effect `Layer.Layer<…>` requirement union reorders between otherwise-identical builds. The flag lives in a separate file because `@microsoft/api-extractor` pins TypeScript ~5.9, which hard-errors on the unknown option, so the meta pass keeps the clean `tsconfigPath`. Best-effort: an unreadable base is returned unchanged.

## The TypeScript 6 pin

The workspace `catalog:silk` is on TypeScript 7, but this package pins `typescript: ^6.0.3` directly, for two independent reasons. TypeScript 7.0 ships no stable compiler API (a version-stub main export) until 7.1, and the two `src/dts/` AST readers drive that API at runtime. And rolldown-plugin-dts auto-selects its generator from the peer-resolved TypeScript major: at ≥ 7 it picks its native "tsgo" generator, which spawns the compiler with `--rootDir dirname(tsconfig)` — the temp dir, for the temp-written tsconfig — so emit fails with TS6059 and declarations leak into the package's `src/`.

Two fixes hold the line together. `deriveDtsPassOptions`/`deriveDeclarationsPassOptions` pin `dts.generator: "tsc"` explicitly, so auto-detection can never fire regardless of which TypeScript tsdown resolves. And tsdown is a declared dependency of this package rather than an undeclared devDependency, so the two `import("tsdown")` seams resolve tsdown against this package's own TypeScript in every install topology — front door, self-hosting builders and a raw-tsdown escape-hatch consumer alike — instead of a host-hoisted tsdown peered against the consumer workspace's TypeScript 7. The `@e2e/bundler` `leaf-escape` fixture guards this (see `../e2e/architecture.md`). Revisit the pin at TypeScript 7.1.

## Per-entry rollups and determinism

The dts pass runs one single-entry `build()` per entry into the shared outDir rather than one multi-entry rollup. A multi-entry rollup makes rolldown code-split declarations shared between entries into a content-hashed sibling chunk whose constituent-module naming and split layout vary across otherwise-identical builds, so both the `.d.ts` and the `.api.json` derived from it flip bytes between identical builds. A single-entry rollup has no shared chunk and is byte-stable by construction; the `stableTypeOrdering` variant above removes the residual union-ordering nondeterminism. The deps posture is identical for every entry, so it is computed once, while the cjs interop plugins are re-instantiated per build because rolldown plugin factories are not safe to reuse across builds.

## The re-export stub

To keep a re-export-heavy multi-entry package compact without reintroducing a shared chunk, a *secondary* entry that is a pure named re-export barrel — only `export { … } from` / `export type { … } from`, no local declarations, no `export *` — whose every name is also exported by the primary `index` entry is emitted as a thin `export { … } from "./index.js"` stub (plus a `.d.cts` pointing at `./index.cjs` under dual format) instead of a second self-contained rollup. API Extractor follows the stub's cross-entry re-export into index's already-self-contained `.d.ts`. It is gated to flat entry names and to packages whose `index` export set is statically enumerable; anything else falls through to a self-contained per-entry rollup. See `src/dts/reexport-stub.ts` for the analysis rules. No in-repo package currently exercises it, so a regression would surface only in this package's own tests — do not delete it on that basis; the posture it serves recurs.

## JSX resolution

`src/jsx/config.ts` resolves the effective JSX runtime so a `.tsx` package builds without per-package wiring. `resolveJsxConfig(tsconfig, override)` maps `compilerOptions.jsx` to a rolldown-shaped `JsxConfig` by delegating to `@effected/tsconfig-json`'s `JsxConfig.fromCompilerOptions`; an explicit override wins, and `preserve`/`react-native`/absent yield `undefined`. `readTsconfigJsx(cwd)` is the best-effort inference source, reading through `TsconfigLoaderSync.compilerOptions` so JSONC and an `extends` chain are both honored — a package inheriting `jsx` from a shared base is the normal shape in this monorepo.

The resolved config flows **one way**: the bundler resolves effective jsx once (override ?? inference) and feeds it into the resolved dts tsconfig, which both passes consume via `dts.tsconfig`. It is not forwarded into rolldown's input options — tsdown rejects a top-level `jsx` key — and the tsconfig already carries the runtime.

## The declaration source-map stripper

`removeDeclarationMaps(pkgDir)` recursively removes `.d.ts.map`/`.d.cts.map` from a built `pkg/`, skipping `node_modules`, and returns the removed paths. The dts pass emits the maps because the resolved tsconfig sets `declarationMap: true` and API Extractor reads them to resolve source positions; but in a published package they reference `.ts` sources the tarball does not ship and leak local paths. The bundler and both self-hosting builders strip them from each prod group **after** meta generation has consumed them; dev keeps them. The `declarations/` tree is a sibling of `pkg/`, outside the argument, so its maps are intentionally left intact as the diagnostics-run input and an inspectable artifact.

## Boundaries and invariants

- **Native dts on the tsc path, never `isolatedDeclarations`.**
- **The dts pass pins `generator: "tsc"` and this package pins `typescript ^6.0.3`** — defense in depth against rolldown-plugin-dts' TypeScript 7 auto-detect. Do not move `typescript` back to the catalog before 7.1.
- **A tsconfig that exists but will not resolve throws; a missing one falls back.** `buildResolvedTsconfig` and `resolvePortableTsconfig` agree on this.
- **The dts and declarations emit passes run on the `stableTypeOrdering` variant; the API Extractor pass never sees it.**
- **The dts pass is one single-entry build per entry.** A pure re-export barrel that is a subset of `index` becomes a stub rather than a rollup.
- **`resolveJsxConfig`'s output feeds the dts tsconfig only**, never rolldown's input options.
- **`removeDeclarationMaps` runs after meta and touches only `pkg/`.**

## Rationale

### Why the tsc path

`isolatedDeclarations` would let rolldown emit declarations without the compiler, but under pnpm symlinks the compiler-free path produces TS2742/TS2883 portability failures in consumers. Running the real compiler under the package's own resolved options is what makes the bundled declarations portable, and the cost — a compiler load per build — is bounded by `emitDts: false` for packages that do not need declarations.

### Why per-entry rollups

Determinism is a publishing property: the `.api.json` feeds the docs corpus and the `.d.ts` is diffed on every release, so byte-flipping declarations between identical builds are a real defect, not cosmetics. Trading one rollup for N single-entry builds costs compile time but removes the shared chunk that was the entire source of the flip.
