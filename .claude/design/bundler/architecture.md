---
status: current
module: bundler
category: architecture
created: 2026-06-05
updated: 2026-06-12
last-synced: 2026-06-12
completeness: 90
related:
  - ../tsdown-plugins/architecture.md
  - ../cli/architecture.md
  - ../github-action-builder/architecture.md
dependencies:
  - ../tsdown-plugins/architecture.md
---

# @savvy-web/bundler architecture

The all-in-one, tsdown-based replacement for the retired `@savvy-web/rslib-builder`. A consumer installs one devDependency (`@savvy-web/bundler`), writes a self-executing `savvy.build.ts` and gets a pinned, tested `tsdown` transitively. Every in-repo package builds via this stack; `@savvy-web/rslib-builder` and `@rslib/core` no longer exist in `systems`.

## Table of Contents

- [Overview](#overview)
- [The two-package split](#the-two-package-split)
- [The savvy.build.ts contract](#the-savvybuildts-contract)
- [defineBuild and runBuild](#definebuild-and-runbuild)
- [TargetGroup and Target model](#targetgroup-and-target-model)
- [Multi-target publishing](#multi-target-publishing)
- [Dual-format esm plus cjs](#dual-format-esm-plus-cjs)
- [Bundling-posture knobs](#bundling-posture-knobs)
- [Per-entry format and bundling overrides](#per-entry-format-and-bundling-overrides)
- [Loose files: standalone bundled outputs](#loose-files-standalone-bundled-outputs)
- [Manifest strip and unminified prod defaults](#manifest-strip-and-unminified-prod-defaults)
- [Self-hosting: the bootstrap ladder](#self-hosting-the-bootstrap-ladder)
- [The shipped ecma.json tsconfig preset](#the-shipped-ecmajson-tsconfig-preset)
- [Dist layout](#dist-layout)
- [Meta generation wiring](#meta-generation-wiring)
- [JSX wiring](#jsx-wiring)
- [Exe compilation wiring](#exe-compilation-wiring)
- [The config-validation gate](#the-config-validation-gate)
- [The orchestrator to tsdown boundary](#the-orchestrator-to-tsdown-boundary)
- [Catalog resolution and the process.cwd() constraint](#catalog-resolution-and-the-processcwd-constraint)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/bundler` is a thin orchestrator. It reads a package's `package.json` and its `savvy.build.ts`, derives per-TargetGroup tsdown options and drives tsdown's programmatic `build()` once per group. Every build behavior — entry detection, manifest emission, catalog resolution, the dts tsconfig port, the per-group loop, the output reporter — lives in `@savvy-web/tsdown-plugins`. The bundler imports those helpers and wires them; it owns no build logic of its own beyond the `savvy.build.ts` contract, arg parsing and report assembly.

**Package:** `@savvy-web/bundler`, at `packages/bundler` in `savvy-web/systems`. **Source:** `src/config.ts` (the `defineBuild` contract), `src/run.ts` (the `runBuild` orchestrator), `src/index.ts` (public surface). **Versioning:** independent; changesets auto-bumps it when `@savvy-web/tsdown-plugins` changes, but it ships on its own — not a fixed group.

The one outstanding capability is full publishability: deriving and validating the complete set of publish targets so a release action can ship every byte-variant without manual config. The build modes (`dev`/`prod`/`meta`/`exe`), multi-target derivation, dual-format, the bundling postures and self-hosting are all in place.

**Build mode versus publish-target name.** `--target <dev|prod|meta|exe>` selects the build *mode* — `prod` builds the `dist/prod/` folder. This is distinct from a publish-target *name* (`npm`, `github`, a custom key), which is a `publishConfig.targets` key and the `dist/prod/<name>/` folder id. `--target prod` builds the prod folder; `npm` remains the default publish-target name within it.

## The two-package split

The program is two packages, split on an interface boundary:

- **`@savvy-web/tsdown-plugins`** — the plugin pack. Interface-only coupling to tsdown (authored against rolldown's `Plugin` *type*; no tsdown runtime import, no tsdown peer dependency). Holds all the build behaviors as composable helpers/plugins. See `../tsdown-plugins/architecture.md`.
- **`@savvy-web/bundler`** — this package. Depends on `tsdown-plugins` and `tsdown` as regular `dependencies`, drives tsdown's `build()` API, configured by `savvy.build.ts`.

The split buys two things. First, **no peer-sync trap**: the common-path consumer installs one devDependency and a tsdown upgrade becomes a bundler release, not an ecosystem-wide peer bump — the precise pain that triggered this program (rslib-builder's drifting `@rslib/core` peer). Second, a **real published escape hatch**: a power user brings their own `tsdown` + `@savvy-web/tsdown-plugins` and composes the same plugins in a hand-written `tsdown.config.ts`. The orchestrator is not a privileged path — anything it does (including the multi-group loop) is exposed as a helper. See the escape-hatch contract in `../tsdown-plugins/architecture.md`.

## The savvy.build.ts contract

A package configures the bundler with a `savvy.build.ts` that is **both declarative and runnable**:

```ts
import { defineBuild } from "@savvy-web/bundler";

export default defineBuild({
  format: ["esm", "cjs"],
  externals: ["typescript"],
  devManifest: "preserve",
  transform({ pkg, targetGroup }) { /* manifest surgery, per TargetGroup */ return pkg; },
});
```

- **No bin.** `package.json` scripts run the file directly: `"build:dev": "node savvy.build.ts --target dev"`, `"build:prod": "node savvy.build.ts --target prod"`.
- **Self-execution** is gated on `import.meta.main` at the *file* (so `run.ts` performs the gate with access to the caller's `import.meta`; `defineBuild` in `config.ts` stays pure). Imported by the silk plugin or the cli for introspection, it returns a side-effect-free config object. Run directly, it parses `process.argv` and builds.
- **Arg surface:** `--target <dev|prod|meta|exe>` (default `dev`) and `--watch` — the build *mode*, not a publish-target name. See `parseArgs` in `src/config.ts`.
- **Meta config:** a tri-state `meta?: MetaOptions | false` (the `MetaOptions` type is re-exported from `@savvy-web/tsdown-plugins`). Omitted/`undefined` → meta generation runs with DEFAULT options (`--target meta` always works, `--target prod` emits the `meta/` bundle); an object → overrides; `false` → opt out (both targets no-op).
- **Exe and JSX config:** `defineBuild` also takes optional `exe?: ExeConfig | ExeConfig[]` (required by `--target exe`) and `jsx?: JsxConfig` (an explicit override; otherwise inferred from the package tsconfig). Both types are re-exported from `@savvy-web/tsdown-plugins`. See [Exe compilation wiring](#exe-compilation-wiring) and [JSX wiring](#jsx-wiring).
- **Node baseline:** native TS type-stripping (Node 24.11+). No tsx fallback.

`savvy.build.ts` replaces rslib's inscrutable factory-notation `rslib.config.ts`. It is agent-legible and a reliable signal the silk plugin can detect and introspect.

## defineBuild and runBuild

Two functions, deliberately separated so the config surface stays pure and the orchestration stays injectable.

- **`defineBuild(input)`** (`src/config.ts`) normalizes and validates the config into a `BuildConfig`, applying defaults (`devManifest: "preserve"`, `transform: defaultManifestTransform`, `minify: false`). It does **not** itself run the build — the `import.meta.main` gate lives in `run.ts`, which has access to the caller's `import.meta`. The optional `format?: ReadonlyArray<BuildFormat>` is the live dual-format field. A pre-existing dead `formats: ReadonlyArray<"esm">` field still sits beside it but is not consumed by the build — `format` is the one `runBuild` reads. See `BuildConfigInput` in `src/config.ts` for the full input shape.
- **`runBuild(config, options)`** (`src/run.ts`) is the orchestrator: parse argv → read `package.json` at cwd → resolve effective jsx (explicit override ?? `readTsconfigJsx` inference) → write the resolved dts tsconfig → derive entries (`packageJsonEntries`) → **run `ConfigValidator.validate(...)` first to fast-fail bad config** → branch on `--target`: `meta` and `exe` short-circuit before the main build; otherwise resolve any per-entry `overrides` into base+override entry partitions (computing the `dualExports` Set) and `normalizeLooseFiles(config.looseFiles)` into descriptors → derive the build groups (a single `dev` group, or all prod groups from `publishConfig.targets`) → call `buildTargetGroups` (jsx, `config.format`, the posture knobs, `overrides`/`dualExports` and the normalized `looseFiles` threaded in via conditional spread) → on `--target prod` write the `targets.json` binding then `removeDeclarationMaps` on each prod group's `pkg/` (after meta has run) → assemble a `BuildReport` and render it via `renderReport`/`ReportPipelineLive`. Every IO dependency is injectable on `RunOptions` so the orchestration is unit-testable without touching disk or spawning tsdown.

The `BuildReport` the bundler assembles is intentionally minimal (per-TargetGroup `{ id, entries, timings, warnings, errors }`). The report *schema* and *reporter pipeline* are owned by `tsdown-plugins`.

## TargetGroup and Target model

Two load-bearing terms from the program glossary:

- **TargetGroup** — a single build output: a `dist/<group>/pkg` folder containing a complete, self-consistent bundle (built code + one specific `package.json` manifest variant). The unit of **bytes**. The `dev` group plus one prod group per distinct byte-variant; the `TargetGroupId` in `tsdown-plugins` is any `string`, and a group is described by `BuildGroupSpec` (`{ id, name }`) so it carries its resolved manifest name.
- **Target** — a publish destination: a registry endpoint plus its publish config. A Target is bound to exactly one TargetGroup (the bytes it ships).

The relationship is **N Targets : 1 TargetGroup** — `dist/prod/npm` shipped to npm + GitHub Packages + a custom registry is three Targets, identical bytes. You split into more than one publishable TargetGroup *only* when a manifest change alters the bundled bytes (in practice a `name`/scope transform, which matters for release attestation). Both relationships are declarative through `publishConfig.targets`: a `name`/string override creates a new byte-variant group, while a `from` target binds an extra registry endpoint to an existing group's bytes. See [Multi-target publishing](#multi-target-publishing).

**The boundary:** the bundler **builds TargetGroups**. Targets (registry upload + attestation) are the release action's job, consuming the built `dist/{group}/pkg` folders. The bundler's responsibility ends at emitting a valid `pkg/` plus the binding that tells the release action which Targets map to which group.

## Multi-target publishing

The bundler wires the build to `publishConfig.targets`. The derivation itself (which groups, which registries, which validation) lives wholly in `@savvy-web/tsdown-plugins`' `resolveTargets` (see `../tsdown-plugins/architecture.md`); the bundler reads config and threads results.

- **`--target prod`** reads `publishConfig.targets`, calls `deriveProdGroups` (a `run.ts` helper wrapping `resolveTargets`, defaulting to `{ npm: true }` when none is declared), builds every resolved group via `buildTargetGroups`, then `writeTargetsBinding(cwd, resolution)` writes `dist/prod/targets.json` and the report carries one group per built group. The single-target common case yields exactly one `npm` group named after the package.
- **`--target dev`** builds a single `dev` group named after the base name and writes NO binding (dev is registry-less, local-link only).
- **The Record-map form is in use across the repo, including the two self-hosting builders.** Every in-repo package declares `publishConfig.targets` as the Record map (`{ npm: true, github: true }`, or single-key `{ npm: true }`), so `--target prod` derives its prod group(s) for real. `deriveProdGroups` keeps a tolerance fallback: an array-valued `targets` (the old rslib-builder shape) reads as `undefined` and falls back to the single-`npm` default — but no in-repo package declares the array form, so only the Record map activates a non-default group.

## Dual-format esm plus cjs

A package can emit both esm and cjs (the rslib parity target for CJS consumers like `@savvy-web/silk`). As with every build behavior, the mechanics live in `@savvy-web/tsdown-plugins` (`format`/`dual`/`cjsDefault` threading, the manifest dual-condition transform, the `fixedExtension: false` finding — see `../tsdown-plugins/architecture.md`); the bundler only surfaces the knob and forwards it.

- **`defineBuild({ format })`** takes an optional `format?: ReadonlyArray<BuildFormat>` (`"esm" | "cjs"`, re-exported from `@savvy-web/tsdown-plugins`). `runBuild` forwards `config.format` into the `buildTargetGroups` call (conditional spread, mirroring `jsx`); `tsdown-plugins` defaults it to `["esm"]` when unset.
- **Dual-format is opt-in.** Adding `"cjs"` triggers esm `.js` plus cjs `.cjs` output, dual `import`/`require` export conditions in the emitted manifest, CJS named-export interop and a `.d.cts` declaration. With the default `["esm"]`, every build is esm-only. The first real `format: ["esm", "cjs"]` consumer is silk (see `../silk/architecture.md`).

## Bundling-posture knobs

Four `defineBuild` knobs let a package pick any rslib bundling posture. As with every behavior, the mechanics live in `@savvy-web/tsdown-plugins` (the per-pass `deps` shapes, the dts-posture mirror); `runBuild` only conditional-spreads each onto the `buildTargetGroups` call.

**tsdown already auto-externalizes declared deps, so `externals` is rarely needed.** tsdown externalizes `dependencies`+`peerDependencies`+`optionalDependencies` by default, so most packages carry no `externals` list at all; github-action-effects keeps only its undeclared `@effect/*` transitives and silk keeps `source-map-support`. `externals` now names only undeclared transitives that must stay external; the four knobs cover the postures that DEPART from the auto-externalize default.

- **`bundleNodeModules?: boolean`** force-bundles every node_modules/workspace dep not in `externals` into the package output (rslib's bundle-everything-except-externals), and the dts pass inlines the matching types. Defaults off. silk's self-contained CJS-requireable artifact depends on it.
- **`bundle?: ReadonlyArray<string>`** force-INLINES the listed packages into the JS output (tsdown `deps.alwaysBundle`), even declared deps that would otherwise be auto-externalized — the inverse of `externals`. JS-pass-only; declarations are not inlined by it (use `bundledPackages` for that).
- **`bundledPackages?: ReadonlyArray<string>`** inlines ONLY the listed packages' declarations into the bundled dts (rslib `dtsBundledPackages` parity), externalizing the rest. JS-pass-unaffected.
- **`dtsExternals?: ReadonlyArray<string>`** externalizes the listed packages in the dts pass ONLY (emitted as `import` references), while the JS pass still bundles them per `bundleNodeModules`. For dependencies whose types cannot be inlined — silk lists `effect`/`@effect/platform` here because effect's `declare module` augmentations would inline into TS2320 conflicts in consumers.

The cjs-default-interop footer (rslib `cjsInterop` parity) and the node-builtin default-interop rewrite are not knobs — they activate automatically for any dual-format build; see `../tsdown-plugins/architecture.md`.

## Per-entry format and bundling overrides

A package can pin SOME export paths to their own format/bundling while the base build uses a different posture. This is silk's shape: base entries are ESM-only with silk-effects externalized, but `./changesets/markdownlint` must be dual-format CJS force-bundling silk-effects (see `../silk/architecture.md`). The partition machinery lives in `@savvy-web/tsdown-plugins` (`EntryOverride` + the partition loop, the `DualExports` Set); the bundler resolves config into partitions.

- **`defineBuild({ overrides })`** takes `ReadonlyArray<BuildEntryOverride>`. Each override lists `entries` (canonical export paths like `"./changesets/markdownlint"` or `"."`) plus its own optional `format`/`bundle`/`externals`/`bundleNodeModules`/`bundledPackages`/`dtsExternals`.
- **`runBuild` resolves export paths to entry partitions.** It maps each override `entries` export path through `createEntryName` (re-exported from tsdown-plugins) to the build entry name, partitions the package's full entry map into a base set (everything not overridden) plus one `EntryOverride` per config override, computes the `dualExports` Set (which export keys emit cjs, from the base format and each override's format) and threads `overrides`/`dualExports` into `buildTargetGroups`. The base `entry` passed to the build EXCLUDES the overridden entries.
- **Override export paths must be canonical** — `runBuild` THROWS if an entry omits the `./` prefix (a non-canonical `"changesets/markdownlint"` would flatten to a valid entry name and build the JS, but its `dualExports` key would not match the manifest's `"./"`-prefixed export key, silently dropping the `require` condition), and throws if an export path is not actually a build entry of the package.
- **The no-override path is byte-identical to before.** With no `overrides`, `runBuild` passes the full entry map and no partitions, so the build is exactly the prior single-partition two-pass loop.

## Loose files: standalone bundled outputs

`looseFiles` emits one or more self-contained bundled files at literal paths inside the package dir, OUTSIDE the exports/dts/meta graph. Its driver is pnpm **config dependencies** — packages that forbid runtime `dependencies` and resolve a `pnpmfile.mjs`/`pnpmfile.cjs` by filename at the package root — but it generalizes to any "emit this source as a standalone bundled file at this exact path + format". The emission mechanics (the extra per-file tsdown pass) live in `@savvy-web/tsdown-plugins`; the bundler surfaces the knob, validates it and forwards the normalized form.

- **`defineBuild({ looseFiles })`** takes `Record<string, string | LooseFileSpec>` (re-exported `LooseFiles`/`LooseFileSpec`). Keys are literal output filenames; values are a source path (bare string) or `{ source, format }`. Format is INFERRED from the key extension (`.mjs` → esm, `.cjs` → cjs); `.js` is ambiguous and requires an explicit `format`. A contradicting explicit format, a path separator in the key, an unsupported extension, or `.js` + cjs (deferred — it would need a post-emit rename) are rejected as `ConfigValidationError`.
- **`runBuild` normalizes once, then forwards.** It calls `normalizeLooseFiles(config.looseFiles)` (re-exported from tsdown-plugins) into descriptors and conditional-spreads them into `buildTargetGroups`. The same `config.looseFiles` is also threaded into the `ConfigValidator.validate` input so a malformed loose file fast-fails alongside every other structural check before any build runs.
- **Pair with `bundleNodeModules` for a self-contained file.** Each loose file inherits its build group's `externals`/`bundle`/`bundleNodeModules` deps posture, so to make a config-dependency pnpmfile (which cannot declare runtime deps) self-contained, set `bundleNodeModules: true`.
- **Loose files are not exports.** They get no manifest `exports` entry, no `.d.ts` and no API-model. This is what lets a pnpm config dependency emit a `package.json` with no `dependencies` and no `pnpmfile.*` in `exports`.

**Known follow-up:** there is no collision guard yet between a loose `outFile` and a real export entry's emitted filename — a loose `index.js` would overwrite the `.` export's `index.js`. It does not affect the pnpmfile use case (distinct filenames), but is a deferred hardening item.

## Manifest strip and unminified prod defaults

Two `defineBuild` defaults live in the bundler so packages stop carrying boilerplate (the mechanics live in `../tsdown-plugins/architecture.md`):

- **`transform` defaults to `defaultManifestTransform`.** Nearly every package's `transform` was the identical block stripping build/dev-only manifest fields (`devDependencies`/`scripts`/`publishConfig`/`packageManager`/`devEngines`/`bundleDependencies`). `defineBuild` applies `defaultManifestTransform` (re-exported from `@savvy-web/bundler` and tsdown-plugins) when no `transform` is supplied. A custom `transform` REPLACES the default, so silk and the two self-hosting builders import and call `defaultManifestTransform` themselves to keep the strip.
- **`minify` defaults to `false` and applies to PROD only.** Prod output is UNMINIFIED by default. This builder targets Node libraries where readable output is preferred — minification trips SCA scanners and degrades stack traces. `defineBuild({ minify: true })` opts back in; dev is never minified regardless.
- **Declaration source-maps are stripped from prod.** `runBuild` calls `removeDeclarationMaps` on each prod group's `pkg/` AFTER meta generation has consumed the `.d.ts.map`/`.d.cts.map` files (the dts tsconfig emits them; API Extractor reads them; they are dead weight that leaks local paths in the published tarball). Dev keeps them so `--target meta` can read them. The two self-hosting builders call `removeDeclarationMaps` directly in their escape-hatch `savvy.build.ts`.

## Self-hosting: the bootstrap ladder

The bundler, `tsdown-plugins` and all seven library/host packages build via this stack instead of rslib. The ladder resolves the chicken-and-egg of a builder building itself across three tiers:

- **Tier 1 — `@savvy-web/tsdown-plugins`** builds itself via an escape-hatch `savvy.build.ts` that imports `buildTargetGroups` from its **OWN `./src`** (`tsx` compiles the TS on the fly — no built copy exists yet). It cannot use `defineBuild`/`runBuild` because those live in the bundler, which is downstream. This is the **one package whose build scripts still run `tsx savvy.build.ts`**: every other package runs `node savvy.build.ts` (Node 24+ native type-stripping over the erasable-types-only file), but tsdown-plugins cannot type-strip a file that imports its own un-built `./src`.
- **Tier 2 — `@savvy-web/bundler`** builds itself via an escape-hatch `savvy.build.ts` that imports `buildTargetGroups` from the **already-built `@savvy-web/tsdown-plugins`** (the workspace link). It cannot use its own `defineBuild`/`runBuild` (that would need an already-built bundler).
- **Tier 3 — the seven downstream packages** (`templates`, `github-action-effects`, `silk-effects`, `github-action-builder`, `cli`, `mcp`, `silk`) build via the normal **front-door** `defineBuild`/`runBuild`, because the bundler is built by the time they run.

Turbo config is mostly generic: the root `turbo.json` carries the generic `build:dev`/`build:prod`/`build:meta`/`types:check` tasks and its `*.ts` input glob already covers `savvy.build.ts`, so most child `turbo.json`s are just `{"tasks": {}}` (`extends ["//"]`). Two exceptions carry an override: mcp (its corpus pipeline) and the meta-emitting leaves, which override `build:meta` `outputs` to add their cross-package `localPaths` dirs (those cross-package paths can never be turbo-tracked outputs anyway, since they write into *other* packages) and add a `build:meta` SCRIPT.

The two escape-hatch (tier 1/2) `savvy.build.ts` files port the externals and prod-strip transform that the package needs; they call `buildTargetGroups` with no `meta`, so API Extractor never runs in a self-build. On `--target prod` both also emit the `dist/prod/targets.json` binding via `writeTargetsBinding(cwd, resolveTargets({ targets: { npm: true, github: true }, baseName: pkg.name }))` — one npm-named group, npm+github collapsed onto it — so a release consumer can resolve their publish targets the same way front-door packages do. The front-door tier-3 files use the corresponding `defineBuild` options.

Package-specific concerns of note: `cli` uses the `dist/dev/pkg` + `dist/prod/npm/pkg` layout and a silk-effects dogfood bin path (`dist/dev/pkg/bin/savvy.js`); `mcp` keeps its corpus under top-level `public/content` because the bundler copies only `public/`; `silk` is the hard case — dual-format with a force-bundled runtime, documented in `../silk/architecture.md`.

**The bundler's own integration fixtures import the source under test** (`src/config.js`/`run.js`), not the built `@savvy-web/bundler` package — they are integration tests of the bundler source, not e2e tests of the built tarball. That removes the bundler's `types:check → build:dev` self-dependency, so `packages/bundler/turbo.json` stays `{"tasks": {}}` and relies on the root's generic `types:check`. A future root `__test__/e2e/` against `dist/` is where a built-package check would live.

## The shipped ecma.json tsconfig preset

The bundler ships its own shared TS base preset (replacing the `@savvy-web/rslib-builder/tsconfig/ecma/lib.json` base that downstream packages used to extend):

- **`packages/bundler/public/ecma.json`** is published via the top-level `public/` copy convention and exported as `"./ecma.json": "./public/ecma.json"`. Every downstream package extends `@savvy-web/bundler/ecma.json` (package specifier).
- **The bundler extends its OWN copy by relative path** (`./public/ecma.json`) rather than the package specifier, to avoid a build-before-typecheck cycle (the package specifier resolves only after the `public/` copy lands in `dist`).
- **`@savvy-web/tsdown-plugins` is upstream of the bundler**, so it cannot consume the package specifier. It keeps a byte-identical **synced local copy** at `packages/tsdown-plugins/ecma.json`, guarded by a unit test that fails if the two files drift.

## Dist layout

```text
dist/
  dev/                  # the dev TargetGroup (registry-less, local-link only)
    pkg/                # ← pnpm linkDirectory points HERE; clean publishable bytes
    meta/               # staging outMetaDir for --target meta before copy into localPaths
  prod/
    targets.json        # the TargetResolution binding for the release action
    npm/                # one folder per distinct byte-variant group; npm is the single-target default
      pkg/              # the tarball root — transformed manifest + built code
      meta/             # meta bundle (release assets) into the canonical group only, when config.meta is set
    github/             # a second byte-variant — e.g. a rescoped @scope/name manifest
      pkg/
```

- **`pkg/` *is* the tarball** — nothing to ignore. This retires rslib's "mix meta files into `dist/npm` and exclude them via package.json ignore patterns" hack.
- The pnpm link root is **`dist/dev/pkg`** (linking never drags meta/buildinfo files).
- **Clean turbo caching:** `build:dev → dist/dev/**`, `build:prod → dist/prod/**` are disjoint cache lanes.
- Local linking itself is the existing pnpm `linkDirectory` + injection mechanism — the bundler does not touch it.

`deriveTargetGroupOptions` in `tsdown-plugins` (`src/build/target-groups.ts`) owns the `outDir` mapping: `dev → dist/dev/pkg`, prod group → `dist/prod/<group>/pkg`.

## Meta generation wiring

The bundler is pure wiring over `generateMeta` from `@savvy-web/tsdown-plugins` (all the behavior lives there — see `../tsdown-plugins/architecture.md`); the bundler decides *when* and *where*.

- **`--target meta`** runs `generateMeta` over the already-built `dist/dev/pkg` dts (API Extractor over the emitted dev `.d.ts`; there is **no** tsdown build), stages the bundle in `dist/dev/meta` and copies the resulting api-model into the `localPaths` configured in `config.meta`. This is why the `build:meta` turbo task depends only on `build:dev`. It resolves `normalizeMetaOptions(config.meta ?? {})` so an omitted `meta` uses defaults; `meta: false` makes it a graceful no-op.
- **`--target prod`** additionally emits a `meta/` release-asset bundle (empty `localPaths`) unless `config.meta` is `false` — so by default meta ships as a publish asset, not mixed into `pkg/`. With multiple prod groups, meta is emitted **once into the canonical group's dir** — the group whose resolved name matches the package name, else the first group. Renamed variants share the canonical group's api-model.
- **The meta bundle is a self-contained "virtual TS env" trio.** Each `meta/` dir (and each mirrored `localPaths` copy) carries `<unscoped>.api.json` + the final transformed `package.json` + a PORTABLE derived `tsconfig.json` (compilerOptions-only, no absolute paths or emit settings) — everything a downstream shiki/Twoslash or API-doc consumer needs to rehydrate the package's types. The `tsdoc-metadata.json` is a published-package artifact and ships in `pkg/`, NOT in the meta bundle. The trio assembly lives in `@savvy-web/tsdown-plugins`' `src/meta/`.
- **Decoupling:** meta is split from the prod build on purpose. `build:prod` emits the `meta/` asset; `savvy build --target meta` emits the api-model into other packages' `localPaths` and depends only on `build:dev`. Neither path re-runs the bundle.
- **`deriveExportPaths`** (a `run.ts` helper) recovers export keys from the package `exports` map to drive the per-entry extraction.

**Known limitation:** `deriveExportPaths` handles only plain string exports. *Conditional* exports (object-valued entries) and nested subpaths like `./foo/bar` fall through to a heuristic. Every current Silk package uses plain string exports, so nothing triggers it today, but a package with conditional exports would need this hardened first.

### The build:meta turbo task

`turbo.json` defines `build:meta` with `dependsOn: ["build:dev"]`, `cache: false`, `outputs: []`. It is **intentionally uncached** because it writes into *other* packages' `localPaths` — outputs outside its own cache scope — so turbo cannot track or restore them correctly. See `README.md` for the consumer-facing description.

## JSX wiring

A `.tsx` package builds with the right JSX runtime with zero extra config. The mapping itself (`resolveJsxConfig`/`readTsconfigJsx`) lives in `@savvy-web/tsdown-plugins`' `src/jsx/`; the bundler resolves the *effective* config once and threads it.

- **Resolution order:** `runBuild` computes `resolveJsxConfig(readTsconfigJsx(cwd), config.jsx)` — an explicit `defineBuild({ jsx })` override wins, else the runtime is inferred from the package's own `tsconfig.json` `compilerOptions.jsx` (`react-jsx`/`react-jsxdev` → automatic with importSource default `"react"`, `react` → classic, `preserve`/none → undefined).
- **Two consumers, one resolution:** the resolved `jsx` flows both into the dts tsconfig (`writeResolvedTsconfig({ jsx, jsxImportSource })`, so declaration emit over `.tsx` sees the same runtime) and into the `buildTargetGroups` call (`inputOptions.jsx`).

## Exe compilation wiring

`--target exe` builds packages that ship a single-executable (SEA) binary. All the behavior lives in `@savvy-web/tsdown-plugins`' `src/exe/` (`normalizeExeOptions`/`runExeBuild`); the bundler wires the branch.

- **The branch** sits after the meta short-circuit, before the main library build. It normalizes `config.exe` via `normalizeExeOptions` (passing the package `os`/`cpu`, injectable as `readOsCpu`) and delegates to the injectable `runExeBuild`, emitting binaries into `dist/dev/pkg/bin`. It throws if no `exe` is configured.
- **`@tsdown/exe` is a RUNTIME dependency of the bundler** (not of tsdown-plugins) — tsdown lazily imports it only when the exe option is used. This keeps tsdown-plugins interface-only while letting the bundler ship the SEA toolchain.
- Real binary compilation is a CI/mac-runner manual step, out of the hermetic test suite; the in-repo tests inject a fake `runExeBuild` and assert the wiring.

## The config-validation gate

A fast-fail validator runs FIRST in `runBuild`, after the publishTargets/exports facts are computed but before any build branch, so a structurally-bad config fails immediately across the dev/prod/meta/exe paths rather than partway through a build. The rule set lives in `@savvy-web/tsdown-plugins`' `ConfigValidator`/`ConfigValidatorLive`; the bundler assembles the `ValidationInput` (baseName, `hasExports`, and the optional `targets`/`exe`/`osCpu`/`meta`/`looseFiles`) and runs `ConfigValidator.validate(...)` via `Effect.runPromise` over `ConfigValidatorLive`. A failure surfaces as a typed `ConfigValidationError`. This validates structural config shape only, not prod-build viability.

## The orchestrator to tsdown boundary

`runBuild` delegates the per-group build loop to `buildTargetGroups` (`tsdown-plugins/src/build/build-target-groups.ts`), which calls `tsdown.build()` with config-file loading bypassed (`config: false`) and inline options derived from `deriveTargetGroupOptions`. The loop runs **two tsdown passes per TargetGroup** to the same outDir — a JS pass (`unbundle: true`, `dts: false`) and a bundled-dts pass (`unbundle: false`, `dts: { emitDtsOnly: true }`, `clean: false`) — so the build emits per-module JS plus a single rolled-up `.d.ts` per public entry. The two-pass mechanics and rationale live in `../tsdown-plugins/architecture.md`. Fixed choices that cross this boundary:

- `unbundle: true` (rolldown `preserveModules`) on the JS pass replaces rslib's `disableSharedChunks` — one-to-one source→output, no shared cross-entry runtime chunk, which sidesteps the multi-entry ESM `__webpack_require__` collision rslib worked around. The dts pass uses `unbundle: false` so declarations roll up.
- `fixedExtension: false` overrides tsdown's node-platform default so output uses the package-`type`-ambient extension (`.js`/`.d.ts` for `"type": "module"`). It stays `false` even for dual-format: tsdown emits esm `.js` plus cjs `.cjs` with no collision under that setting, while `fixedExtension: true` would wrongly yield `.mjs`. See the empirical finding in `../tsdown-plugins/architecture.md`.
- bin shebang/`chmod` is tsdown's native `ShebangPlugin` — the bundler only handles bin→entry naming and the manifest `bin` rewrite, not the executable bit.
- **`define` forwards compile-time global replacements** (rslib-builder parity). `defineBuild({ define })` takes a `Record<string, string>` of verbatim source replacements (values are inserted as-is, so string literals must be pre-quoted: `{ "process.env.FLAG": JSON.stringify("on") }`). `runBuild` conditional-spreads `config.define` into the `buildTargetGroups` call; tsdown-plugins threads it through `deriveInput` into BOTH the JS and dts passes. It is build-level — shared by every entry partition, not per-override — and is merged AFTER the auto-injected `process.env.__PACKAGE_VERSION__` define so a user key of the same name wins. See `../tsdown-plugins/architecture.md` for the merge mechanics.

The build loop is a **composable helper, not locked in the orchestrator**, so the escape hatch gets multi-group builds too. See `../tsdown-plugins/architecture.md` for the manifest-emit plugin, the dts tsconfig and the rest of what crosses into tsdown.

## Catalog resolution and the process.cwd() constraint

For a prod manifest the bundler must resolve `catalog:`/`workspace:` specifiers to concrete ranges. It **delegates this entirely** to `workspaces-effect`'s `CatalogResolver` (via `resolveManifest` in `tsdown-plugins`). The bundler owns no catalog-source logic.

The load-bearing constraint that flows from that delegation: `CatalogResolver` has no cwd parameter — it discovers the workspace root from **`process.cwd()`**. The bundler satisfies this because `savvy.build.ts` self-executes in the package directory (`node savvy.build.ts` runs with cwd = the package), and catalogs are workspace-wide, so any cwd inside the target workspace yields the same catalog set. Resolving a manifest for a workspace *other* than `process.cwd()`'s is out of scope. This delegation is also the fix for the long-standing `catalog:silkPeers`/state-file ordering bug: `CatalogResolver` assembles catalogs durably (inline `pnpm-workspace.yaml` + config-dependency hook-replay + lockfile) without depending on the transient `.pnpm-workspace-state-v1.json`. See the delegation detail in `../tsdown-plugins/architecture.md`.

## Boundaries and Invariants

- **The bundler owns no build behavior.** Every behavior is a helper in `@savvy-web/tsdown-plugins`; the bundler only wires them. Anything the front door does, a hand-written `tsdown.config.ts` can do by importing the same helper. This includes meta: `generateMeta` lives in tsdown-plugins; the bundler only decides when (`--target meta`/`--target prod`) and where (`localPaths`/`dist/prod/npm/meta`).
- **Meta is decoupled from the bundle.** Neither `--target meta` nor the npm meta-asset path re-runs the tsdown build — they run API Extractor over the already-emitted dev `.d.ts`. `build:meta` is uncached and depends only on `build:dev`.
- **The bundler's responsibility ends at `dist/{group}/pkg` plus `dist/prod/targets.json`.** Registry upload + attestation (Targets) are the release action's job; it consumes the binding to learn which built group each Target deploys. `resolveTargets` is the single source of truth for the derivation — the bundler never reimplements it.
- **Multi-target derivation is live; the legacy-array path is effectively dead in-repo.** Every in-repo package — including the two self-hosting builders — declares the Record-map `publishConfig.targets`, so `--target prod` derives prod groups from it and every package emits a `dist/prod/targets.json` binding (the front door via `runBuild`, the self-hosting builders via their escape-hatch `writeTargetsBinding` call). The array-valued `targets` fallback (the old rslib-builder shape) still reads as `undefined` and falls back to the single-`npm` default, but no in-repo package exercises it.
- **Dual-format is opt-in.** `format` defaults to esm-only. The bundler surfaces `defineBuild({ format })` and forwards it; the actual format/interop/manifest behavior is `tsdown-plugins`'.
- **Config validation runs first.** `ConfigValidator.validate` gates every target path; the rules live in tsdown-plugins (`resolveTargets`, the exe/meta checks) and the bundler only assembles the `ValidationInput`. It is structural-shape validation only.
- **`tsdown` is a regular dependency, not a peer.** Consumers never carry `tsdown`/`@rslib/core` in their own dependency tree — they install one devDependency. `@tsdown/exe` is a bundler runtime dependency (lazily imported by tsdown for `--target exe`), again not a peer.
- **Self-hosting is complete.** Every in-repo package builds via the bundler stack; `@savvy-web/rslib-builder` and `@rslib/core` are decommissioned from `systems`. The two upstream packages (`tsdown-plugins`, `bundler`) self-build through escape-hatch `savvy.build.ts` files; everything else uses the front door — see [Self-hosting: the bootstrap ladder](#self-hosting-the-bootstrap-ladder).
- **The bundling-posture knobs are pure wiring.** `bundleNodeModules`/`bundle`/`bundledPackages`/`dtsExternals` are conditional-spread onto `buildTargetGroups`; the dts-posture mirror, the cjs-default-interop plugin and the node-builtin default-interop plugin live in tsdown-plugins. See [Bundling-posture knobs](#bundling-posture-knobs).
- **`define` is pure wiring; the version-key fix lives in tsdown-plugins.** `defineBuild({ define })` is conditional-spread onto `buildTargetGroups` and merged after the auto-version key in both passes (a same-named user key wins). See [The orchestrator to tsdown boundary](#the-orchestrator-to-tsdown-boundary).
- **Per-entry overrides are resolved in `runBuild`, not the build loop.** `runBuild` maps override export paths to entry partitions (throwing on a non-canonical or non-existent export path), computes the `dualExports` Set and threads partitions into `buildTargetGroups`; tsdown-plugins owns the partition loop. A no-override build is byte-identical. See [Per-entry format and bundling overrides](#per-entry-format-and-bundling-overrides).
- **Loose files are outside the exports/dts/meta graph.** `defineBuild({ looseFiles })` emits standalone bundled files at literal paths (pnpm config-dependency pnpmfiles being the driver); `runBuild` normalizes via `normalizeLooseFiles`, validates through `ConfigValidator` and forwards descriptors to `buildTargetGroups`. They get no manifest export, no `.d.ts` and no api-model. No collision guard with real export filenames yet. See [Loose files](#loose-files-standalone-bundled-outputs).
- **`externals` lists only departures; defaults strip and unminify.** tsdown auto-externalizes declared deps, so `externals` names undeclared transitives only. `transform` defaults to `defaultManifestTransform` (a custom transform replaces and re-calls it), `minify` defaults off and applies to prod only, and prod declaration source-maps are stripped after meta generation. See [Manifest strip and unminified prod defaults](#manifest-strip-and-unminified-prod-defaults).

## Rationale

### Why a thin orchestrator

Putting every behavior in `tsdown-plugins` and keeping the bundler thin is what makes the escape hatch first-class: the front door and a hand-written `tsdown.config.ts` are the same building blocks, so there is no privileged private surface that the escape hatch must reverse-engineer. It also keeps the bundler's own surface (`defineBuild`/`runBuild`) tiny and injectable for tests.

### Why programmatic tsdown, not a peer

rslib-builder's maintained `@rslib/core` peerDependency drifted out of sync and caused real install firefights. Depending on `tsdown` programmatically as a regular dependency makes a tsdown upgrade a single bundler release rather than a coordinated peer bump across the ecosystem's repos.

### Why delegate catalog resolution

`workspaces-effect`'s generic `CatalogResolver` solves the state-file ordering bug durably and generically, so the bundler delegates and owns no catalog-source logic — removing a whole milestone of cross-repo `pnpm-plugin-silk` work. The cost is the `process.cwd()` workspace-discovery constraint described above.
