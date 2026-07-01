---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-06-30
last-synced: 2026-06-30
completeness: 92
related:
  - ../cli/architecture.md
  - ../silk-effects/architecture.md
  - ../tsdown-plugins/architecture.md
  - ../bundler/architecture.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/silk architecture

The single package a consumer installs to get the whole Silk Suite dev-tooling system. A thin config-integration shim surface over `@savvy-web/silk-effects`, plus a static Biome preset asset.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [How silk builds: ESM-only base, two CJS overrides that inline the runtime](#how-silk-builds-esm-only-base-two-cjs-overrides-that-inline-the-runtime)
- [The shim contract](#the-shim-contract)
- [Export map](#export-map)
- [The shipped TSConfig convention presets](#the-shipped-tsconfig-convention-presets)
- [Boundaries and invariants](#boundaries-and-invariants)
- [The type-portability invariant](#the-type-portability-invariant)
- [Consumer model](#consumer-model)
- [Rationale](#rationale)

## Overview

`@savvy-web/silk` is the install surface, not a library. Each subpath export is a thin **shim** that re-exports `silk-effects` logic shaped into the exact module form an external tool's config loader expects. The shims carry no business logic — they re-export from the `Changesets`, `Commitlint` and `Lint` namespaces of `silk-effects` and reshape the export (default vs named, array vs object) to match what the consuming tool loads. The two config-factory shims (`commitlint`, `lint`) wrap their factory in a silk-local **facade** so the inferred return type stays portable for consumers — see [the type-portability invariant](#the-type-portability-invariant).

**Package:** `@savvy-web/silk`
**Location:** `packages/silk` in `savvy-web/systems`
**Build:** ESM-only base with two dual-format CJS override entries, via `@savvy-web/bundler`; ships the Biome asset through the top-level `public/` convention. See [How silk builds](#how-silk-builds-esm-only-base-two-cjs-overrides-that-inline-the-runtime).
**Versioning:** independent, but auto-coupled to `@savvy-web/cli` and `@savvy-web/mcp`. silk declares both as `workspace:*` source dependencies; changesets treats `workspace:*` as their exact current version, so a cli or mcp release pushes silk's dep out of range and auto-PATCH-bumps silk (via the repo-wide `updateInternalDependencies: patch`), which re-pins the exact cli/mcp version at publish. Because cli/mcp are source `dependencies` (not source `peerDependencies`), silk gets a PATCH, not a forced major. See [How silk builds](#how-silk-builds-esm-only-base-two-cjs-overrides-that-inline-the-runtime) for the peerDep promotion transform that re-pins them.

It replaces the config-integration subpaths of three standalone packages (`@savvy-web/changesets`, `@savvy-web/commitlint`, `@savvy-web/lint-staged`) as drop-in equivalents.

## Current State

Implemented and dogfooded inside `systems` (`.changeset/config.json`, commitlint, lint-staged, biome and markdownlint config reference `@savvy-web/silk/*`). All shims live under `src/`, one file per subpath; the Biome preset is a copied `public/` asset, not a shim. `private: true` in source; the builder flips it on build. silk builds via `@savvy-web/bundler`. See [How silk builds](#how-silk-builds-esm-only-base-two-cjs-overrides-that-inline-the-runtime) for the build posture.

## How silk builds: ESM-only base, two CJS overrides that inline the runtime

silk is the most demanding consumer of the bundler, and reconciling it drove the bundler's bundling-posture knobs and the per-entry override + node-builtin interop work (see `../tsdown-plugins/architecture.md`). The authoritative config is `packages/silk/savvy.build.ts`; its comment headers are the source of truth for each decision below.

**The shipped posture: ESM-only base, force-bundle only the entries an external tool loads via CJS.** The constraint is that silk-effects is ESM-only (a transitive dep, `workspaces-effect`, has no `require` condition), so any entry an external tool `require()`s cannot externalize silk-effects — it must inline it. The base entries are ESM-only and externalize silk-effects; two per-entry overrides (`./changesets/changelog` and `./changesets/markdownlint`) build dual-format and force-bundle silk-effects so only those two entries pay the inlining cost.

- **Base build is `format: ["esm"]` and externalizes silk-effects** (`externals: ["source-map-support", "@savvy-web/silk-effects"]`). The base ESM entries reference silk-effects via `import "@savvy-web/silk-effects"` instead of inlining its large ESM-only transitive tree. `source-map-support` is an undeclared transitive external. `semver` and `typescript` are not listed — they are declared deps that tsdown auto-externalizes. `semver` MUST stay external because rolldown cannot emit its circular CJS modules `comparator` ↔ `range` into ESM without a `require_range is not a function` init-order crash, so it stays a declared runtime dep.
- **`@savvy-web/silk-effects` is a devDependency, re-injected into published `dependencies` by the transform.** This is load-bearing: a regular `dependency` would be auto-externalized AND would make a CJS override's dts re-emit a bare `require` of ESM-only silk-effects → crash. As a devDependency, the overrides are free to bundle it as node_modules; the base entries externalize it explicitly; and the transform pulls its already-resolved spec from `devDependencies` back into the published `dependencies` so consumers can resolve the base entries' `import`.
- **`dtsExternals: ["effect", "@effect/platform"]` externalizes those two in the declaration pass only.** The emitted `.d.ts`/`.d.cts` reference effect's types via `import` rather than inlining them. Inlining effect's cross-module `declare module` interface augmentations produced conflicting interface-extension errors (TS2320) when a consumer type-checked silk's dts. effect and `@effect/platform` are declared as runtime dependencies so consumers can resolve those dts type imports.
- **Two CJS override entries: `./changesets/changelog` and `./changesets/markdownlint`.** Both are loaded by an external tool through a CommonJS `require()` path — the Changesets CLI resolves the changelog formatter via `resolve-from` + `require()`, and markdownlint-cli2 `require()`s its custom rules. An ESM-only export (only `import` + `types`, no `require` condition) makes the CJS resolver throw `ERR_PACKAGE_PATH_NOT_EXPORTED`, which broke `savvy changeset version`. Since CJS cannot `require()` ESM-only silk-effects, each override sets `format: ["esm", "cjs"]` and `bundleNodeModules: true` to INLINE silk-effects and its transitive node_modules; silk-effects is not externalized in an override (a partition does not inherit the base `externals`), so rolldown treats it as bundleable node_modules and emits co-located `.cjs` chunks the entry requires relatively. The base ESM entries stay external. The markdownlint override additionally sets `bundledPackages: ["@commitlint/types"]` to inline that package's declarations into its own dts; this need not be set top-level because no base entry's `.d.ts` references `@commitlint/types` (those types surface through the published silk-effects `Commitlint` namespace).
- **The cjs-default-interop and node-builtin default-interop plugins are load-bearing for the CJS overrides.** rolldown's `output.exports` cannot emit `module.exports = <default>` while keeping named exports, so an ESM consumer doing `import(x).default` would receive a `{ default, ...named }` wrapper. silk's `./changesets/markdownlint` default-exports the rules ARRAY, which markdownlint-cli2 reads as `module.default` and `.flat()`s; without the interop footer it gets the wrapper and aborts. Separately, the node-builtin default-interop fix is what made the overrides' CJS work at all: a transitive dep (vfile, `export {default as minproc} from 'node:process'`) bundled into the `.cjs` crashed `savvy changeset version` with `Cannot read properties of undefined` until the rewrite landed. Both activate automatically because these entries build dual-format — see `../tsdown-plugins/architecture.md`.
- **The peerDep promotion transform.** `@savvy-web/cli` and `@savvy-web/mcp` are declared as regular `dependencies` in source (so changesets auto-PATCH-bumps silk to re-pin the exact peer when cli or mcp releases, rather than force-MAJOR-bumping it as a source `peerDependency` on a released workspace package would). The custom transform promotes them back into `peerDependencies` for the published manifest, keeps only `semver`/`effect`/`@effect/platform`/`@savvy-web/silk-effects` as runtime `dependencies` (the externalized and dts-externalized packages consumers must resolve), strips the rest since everything else is bundled, and calls `defaultManifestTransform` itself to keep the standard strip.

## The shim contract

A shim is a drop-in replacement: a config file that previously imported a subpath of one of the three old packages must work unchanged after swapping the import to the matching `@savvy-web/silk` subpath. That means each shim must reproduce the **module shape** the tool's loader consumes, not just re-export symbols:

- `./changesets/changelog` — default export is the `@changesets/types` `ChangelogFunctions` object the Changesets CLI loads from `.changeset/config.json`'s `changelog` field. See `src/changesets/changelog.ts`.
- `./changesets/markdownlint` — default export is the rule array markdownlint-cli2 loads, plus the named rule objects. See `src/changesets/markdownlint.ts`.
- `./changesets/remark` — named exports for every transform plugin, preset and lint rule that remark configs import. See `src/changesets/remark.ts`.
- `./commitlint/static` — default export is the static config object (no auto-detection). The root `./commitlint` default-exports `CommitlintConfig` (the auto-detecting factory, now a silk-local facade — see [the type-portability invariant](#the-type-portability-invariant)).
- `./lint` — re-exports the full lint-staged consumer surface (handlers, `Preset`, `createConfig`, workspace utils, section/template data). CLI commands are deliberately **not** re-exported here — those are `cli`'s job.

The shim files are the single source of truth for the exact reshaping; the contract above is what must stay stable so external config files do not break.

## Export map

```text
./changesets              ← changeset class/services API surface
./changesets/changelog    ← ChangelogFunctions default for .changeset/config.json
./changesets/markdownlint ← markdownlint-cli2 rules (default array + named)
./changesets/remark       ← remark transform plugins + presets + lint rules
./commitlint              ← CommitlintConfig (auto-detecting) + types
./commitlint/static       ← static config default (no auto-detection)
./commitlint/prompt       ← commitizen adapter
./commitlint/formatter    ← custom error formatter
./lint                    ← handlers / Preset / createConfig / utils / section data
./biome                   ← static silk.jsonc asset (copied, not a shim)
./tsconfig/node/root.json ← Node monorepo ROOT preset (convention, no Silk build tool)
./tsconfig/rspress/website.json ← standard RSPress SITE preset (browser/SSG)
```

The mapping from each old package's subpaths into this tree is the load-bearing decision; see the `exports` field in `package.json` for the authoritative wiring.

## The shipped TSConfig convention presets

In the ecosystem-wide TSConfig preset taxonomy, **silk owns the convention presets — roots plus framework configs**, while the build tools own the lib/build base (see the canonical taxonomy in `../bundler/architecture.md`). silk's presets are for repos that FOLLOW Silk conventions but do not have a Silk build tool at the relevant package, so the lib base lives elsewhere. They ship under top-level `public/tsconfig/**` and export under the `tsconfig/` namespace:

- **`./tsconfig/node/root.json`** — a Node monorepo ROOT preset for a root where `@savvy-web/bundler` is not a dependency of the root `package.json` (so it cannot extend the bundler base). Self-contained: it inlines the Node-24 root settings (`module: nodenext`, `target: es2025`, composite/declaration, `types: ["node"]`) rather than extending.
- **`./tsconfig/rspress/website.json`** — a standard RSPress SITE preset, aligned with RSPress's official website tsconfig. The load-bearing decision is the **es2023/browser split**: a website runs in the browser plus SSG, NOT on Node 24, so it targets `es2023` (not the build base's `es2025`), sets `noEmit`, `module: esnext` + `moduleResolution: bundler`, `jsx: react-jsx` and `mdx: { checkMdx: true }`. See the file for the full compilerOptions and `include` set.

The es2025-vs-es2023 split is the reason these are silk's job, not the bundler's: the bundler base is a Node-24 LIBRARY base (`es2025`, emit), which is wrong for a browser/SSG site. The TS6 baseline (explicit `types`, no deprecated `node`/`node10`, `dom` subsuming `dom.iterable`) applies to both — see `../bundler/architecture.md`.

The Biome preset (`./biome`) now also formats these presets under `public/tsconfig/**` and excludes `.claude/worktrees` so a nested Claude Code worktree does not trip Biome's nested-root abort in any consumer.

## Boundaries and invariants

- **`@savvy-web/silk` never imports `@savvy-web/cli`.** Within the repo it depends only on `@savvy-web/silk-effects`. This is grep-guarded.
- **`peerDependencies` declares the install-wiring and real-tool peers.** It carries the merged real-tool peers of the three source packages (Biome, husky, the commitlint packages, commitizen, the changesets CLI, lint-staged, markdownlint-cli2, the codequality formatter, turbo) plus the toolchain peers via `catalog:silkPeers`; the transform additionally promotes `@savvy-web/cli` and `@savvy-web/mcp` into this list. Installing `silk` pulls the `savvy` bin and all the tools its configs reference. See the `peerDependencies` field in `package.json` for the authoritative set.
- **CJS is required for two entries, not the whole package.** The Changesets CLI `require()`s `./changesets/changelog` and markdownlint-cli2 `require()`s `./changesets/markdownlint`. silk's base entries are ESM-only (externalizing silk-effects); two per-entry overrides pin those two entries to `format: ["esm", "cjs"]` and force-bundle silk-effects (`bundleNodeModules`) so the `require` resolves from each entry's self-contained bytes rather than chasing an ESM-only transitive dep. The dual-format build activates the cjs-default-interop footer and the node-builtin default-interop rewrite. See [How silk builds](#how-silk-builds-esm-only-base-two-cjs-overrides-that-inline-the-runtime).
- **silk owns convention presets (roots + framework), not the lib base.** The `./tsconfig/node/root.json` and `./tsconfig/rspress/website.json` presets are for repos following Silk conventions without a Silk build tool at that package; the lib/build base is the build tools' job (`@savvy-web/bundler`). The website preset is browser/SSG-targeted (`es2023`, `noEmit`), deliberately diverging from the Node-24 build base. See [The shipped TSConfig convention presets](#the-shipped-tsconfig-convention-presets) and the taxonomy in `../bundler/architecture.md`.
- **The Biome asset excludes `.claude/worktrees` and formats `public/tsconfig/**`.** The exclusion keeps a consumer's nested Claude Code worktrees from tripping Biome's nested-root abort; the include adds the shipped tsconfig presets to the formatted set.
- **The shipped Biome asset is pinned to a Biome version in three coupled hand-update spots that must move together.** The asset (`public/biome/silk.jsonc`) carries an exact `$schema` URL, `package.json` declares the matching `@biomejs/biome` optional peer (a `~`-pinned minor line), and `@savvy-web/cli`'s `BIOME_VERSION` const (`packages/cli/src/commands/lint/biome-version.ts`) is the exact release `savvy lint`/`savvy check` sync consumer `biome.json(c)` `$schema` URLs to. Bump all three on a Biome upgrade — see `packages/silk/CLAUDE.md` for the checklist and `../cli/architecture.md` for the sync path. The asset stays on stable, broadly-supported keys: 2.5-only keys (e.g. `javascript.resolver.experimentalPnpmCatalogs`, dogfooded in the repo root `biome.jsonc`) are deliberately kept OUT of `silk.jsonc` so consumers still on an older Biome do not break. Promoting 2.5-only config into the asset is tracked in savvy-web/systems#169.
- **The asset's `noUndeclaredDependencies: off` override targets the test surface broadly.** It covers `__test__/` trees, `*.test`/`*.spec` files and the common `vitest.*`/`vite.config.*` config filenames, so test and tooling files can import devDependency-only packages without the rule firing. See the `overrides` block in `public/biome/silk.jsonc` for the authoritative glob set; it tracks the suite-wide `__test__/` convention.

## The type-portability invariant

A consumer config that infers a silk factory's return type must emit a portable `.d.ts` — its declaration must name the return type from `@savvy-web/silk` (a direct dependency), never from `@savvy-web/silk-effects` (only a transitive dependency). TypeScript names an inferred type from where the function **signature** is declared, not where the value is imported, so a shim that simply re-exports the silk-effects class by value (`export const Preset = Lint.Preset`) leaks the canonical return type back to silk-effects and triggers **TS2883** ("inferred type cannot be named… likely not portable") in any `export default CommitlintConfig.silk()` / `export default Preset.silk()` config.

The fix is a silk-local **facade**: each config-factory shim declares the factory's method signatures in silk itself, annotated with a silk-owned return type, and delegates the body to the silk-effects implementation. This pins the consumer-visible canonical home to `@savvy-web/silk/*`.

- `commitlint` — an empty-extends interface (`CommitlintUserConfig extends Commitlint.CommitlintUserConfig`, structurally identical, auto-syncing, silk-owned canonical home) plus a `CommitlintConfig` object facade whose `silk()` returns silk's `CommitlintUserConfig`. See `src/commitlint/index.ts`.
- `lint` — a `Preset` object facade wrapping the silk-effects statics, each annotated with silk's own `LintStagedConfig` alias. See `src/lint/index.ts`.

The facade is behaviorally equivalent to the silk-effects class: those classes have private constructors and only static factory methods, so consumers never instantiate or use them as a class type. The `Changesets`/`Commitlint`/`Lint` namespaces in silk-effects are unchanged and still consumed by cli/mcp; silk-effects itself is untouched. The changesets shims export plain values, not an inferred factory return type, so they do not need facades. The rejected alternative — `dtsBundledPackages: ["@savvy-web/silk-effects"]` — is invalid because API Extractor cannot inline a star-namespace re-export.

## Consumer model

Install `@savvy-web/silk` → `autoInstallPeers` pulls `cli` (the `savvy` bin) plus the real tools its configs reference → `savvy init` seeds the configs that reference `@savvy-web/silk/*` and wires husky hooks to `savvy` subcommands → at runtime both `silk` (via its shims) and `cli` (via its handlers) resolve their logic from `silk-effects`. The Biome preset is referenced as `extends: "@savvy-web/silk/biome"`.

## Rationale

### Why silk holds no logic

The source tools couple their CLI commands to their config-export modules through shared internal logic, so that logic cannot sit in silk without `cli` importing silk. The logic lives in `silk-effects` instead. silk is a pure config-integration shim surface; `cli` a pure command host; neither imports the other. See `../silk-effects/architecture.md` for the extraction and `../cli/architecture.md` for the command host.

### Why nested subpaths, no root barrel

silk is not a library to import wholesale — it is a set of config-integration entry points each loaded by a different tool. A root barrel would imply a coherent API; the nested subpaths instead mirror exactly the module shapes the external tools load.
