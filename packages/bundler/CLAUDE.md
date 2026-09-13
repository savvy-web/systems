# @savvy-web/bundler

`@savvy-web/bundler` is the tsdown-based build orchestrator for the Silk Suite — the `defineBuild`/`runBuild` front door and the self-executing `savvy.build.ts` contract. Drives tsdown programmatically over `@savvy-web/tsdown-plugins`.
→ `@../../okf/decisions/bundler-tsdown-plugins-split.md`
Load when changing the boundary between this package and `@savvy-web/tsdown-plugins`.

## Key surface

- `build(input?, overrides?)` — canonical `savvy.build.ts` front door; calls `defineBuild(input)` then `runBuild`, deriving `cwd` from `dirname(process.argv[1])` and `argv` from `process.argv.slice(2)`. `defineBuild`/`runBuild` remain exported as primitives.
- `defineBuild`/`runBuild` orchestrator; `runBuild` runs the `ConfigValidator` service first to fast-fail on bad config across dev/prod/exe.
- Catalog/`workspace:` resolution delegated to tsdown-plugins' `resolveManifest` (over `@effected/workspaces`).
- Effect v4 (`effect` on `catalog:effect`), in line with the rest of the repo. v4 absorbed `@effect/platform` into core, so there is no `@effect/platform` devDep and `@effect/platform-node` sits on `catalog:effect`.
- `--target prod` derives byte-variant groups from the Record-map `publishConfig.targets`, writes the `dist/prod/targets.json` binding, and calls tsdown-plugins' `runMetaPass` — the single meta-generation orchestrator — per group (emitting a `meta/` release asset + `meta.localPaths`, with `meta.optimistic` next-version forward-looking). `runBuild` no longer carries an inline meta block; `runMetaPass` is shared with both self-hosting escape hatches.
- `--target exe` SEA-compiles via `runExeBuild` (`@tsdown/exe` is a runtime dep).
- `defineBuild` options include `format` (`BuildFormat`, default esm-only), `jsx`, `bundle`, `overrides` (per-entry format+bundling partitions), `define`, `looseFiles`, `bundleNodeModules`, and `plugins` (custom rolldown `Plugin`s, forwarded to every tsdown pass as `extraPlugins`). `defaultManifestTransform` is the default `transform`; `minify` defaults false and prod-only.
- Bundled, self-contained `.d.ts` per public entry is the default; JS stays per-module — EXCEPT under `bundleNodeModules`, which also bundles the JS into one self-contained file per entry (`npm pack` strips the `node_modules` dirs a per-module pass would write its inlined deps into).
- Zero-config ambient `.d.ts` exports: `runBuild` validates types-only hand-authored declaration entries early (`extractAmbientDts` + `assertNoEntryCollisions`, fast-fail before any build branch); the copy itself now happens inside tsdown-plugins' `buildTargetGroups`, not here, so every build path — including the self-hosting escape hatches that call `buildTargetGroups` directly and never reach `runBuild` — gets it. `src/index.ts` re-exports `extractAmbientDts` + `AmbientDtsEntry`.
- `runBuild` threads a `BuildCollector` through the build/meta/exe phases and renders ONE unified build log from its snapshot — quiet by default (one line per target group), `--verbose` for a per-file table — surfacing collected diagnostics before a failure rethrows. On dev/prod it also writes `dist/<target>/issues.json` via the injectable `writeIssues` hook (defaults to tsdown-plugins' `writeIssuesArtifact`), the structured counterpart of the rendered log — written on EVERY terminal path, including the `catch` before a rethrow, stamped with `buildOk` plus a `failure { name?, message }` so a crashed build never reads as a clean gate. The outer `try` opens right after the collector, so setup and config-validation failures stamp the artifact too, and on BOTH terminal paths the artifact is written BEFORE the log renders — a rendering failure must never cost the structured diagnostics. In the `catch`, rendering is itself best-effort so the ORIGINAL build error is always what propagates. The write stays best-effort and never masks the real build outcome; the self-hosting `savvy.build.ts` escape hatches stamp it the same way from a `finally`.
- Ships `@savvy-web/bundler/tsconfig/ecma.json` (file at `public/tsconfig/ecma.json`; `tsdown-plugins` extends it by relative path, `rspress-builder` keeps a synced copy), the shared TS base config, and `@savvy-web/bundler/env`, an ambient `.d.ts` export (sourced from `src/env.d.ts`) declaring the build-injected `process.env.__PACKAGE_VERSION__` — absent when running unbuilt source. Also ships `@savvy-web/bundler/og` (`src/og.ts`): `ogImage.satori(options?)`, the default 1200×630 Open Graph card for `meta.tsdoctor.openGraph.generate`, rendered through the OPTIONAL peers `satori` and `@resvg/resvg-js` (dynamic-imported on first render; a missing peer rejects naming both) with the Inter SemiBold font under `public/assets/` (SIL OFL, license alongside), which `copyPublicDir` lands at `pkg/assets/`. `runBuild` passes the resolved `targets` into `runMetaPass` so the emitted `tsdoctor.json` can derive its registries.
- Self-hosts (built by its own escape-hatch `savvy.build.ts`, which calls `runMetaPass` directly); versions independently from `tsdown-plugins`. On prod its self-build emits its own api-model, `dist/prod/issues.json`, and is API-Extractor validated, so the bundler now publishes into the mcp + website corpus.

## Design

Overview — the orchestrator→tsdown boundary, the TargetGroup model, dist layout, meta/exe wiring, and the self-hosting escape hatch:
→ `@../../okf/modules/bundler.md`
Load first when changing build orchestration, the API-model (meta) pass, `--target exe` SEA builds, or the bundler/tsdown-plugins self-hosting `savvy.build.ts` files.

The `savvy.build.ts` contract as a consumer-side interface:
→ `@../../okf/interfaces/savvy-build-config.md`
Load when changing the `build()`/`defineBuild`/`runBuild` surface or the full `defineBuild` option set — what a consumer's `savvy.build.ts` may depend on staying stable.

The shipped tsconfig preset:
→ `@../../okf/interfaces/bundler-tsconfig-preset.md`
Load when changing `tsconfig/ecma.json` or the self-containment rule every shipped preset follows.
