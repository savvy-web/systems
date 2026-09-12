---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-09-12
last-synced: 2026-09-12
completeness: 92
related:
  - ./plugin.md
  - ../workspace/package-layering.md
  - ../mcp/architecture.md
  - ../cli/architecture.md
  - ../silk-effects/architecture.md
  - ../changelog/architecture.md
  - ../tsdown-plugins/architecture.md
  - ../bundler/architecture.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/silk architecture

The single package a consumer installs to get the whole Silk Suite dev-tooling system: the **carrier** of the `savvy` and `savvy-mcp` bins, a thin config-integration shim surface over `@savvy-web/silk-effects`, a static Biome preset and two TSConfig convention presets.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The carrier bins](#the-carrier-bins)
- [How silk builds](#how-silk-builds)
- [The shim contract](#the-shim-contract)
- [Export map](#export-map)
- [TSConfig convention presets](#tsconfig-convention-presets)
- [Boundaries and invariants](#boundaries-and-invariants)
- [The type-portability invariant](#the-type-portability-invariant)
- [Consumer model](#consumer-model)
- [Rationale](#rationale)

## Overview

`@savvy-web/silk` is an install surface, not a library. It is the top (L4) of the [package layering](../workspace/package-layering.md): "carrier + config shims". As the carrier it owns the `bin` entries for `savvy` and `savvy-mcp`, one-import shims over the front ends' `./main`, so installing silk alone puts both bins on a consumer's PATH under every package manager with no hoist. Each subpath export is a **shim** that re-exports `silk-effects` logic shaped into the exact module form an external tool's config loader expects (default vs named, array vs object). The shims carry no business logic; the two config-factory shims (`commitlint`, `lint`) wrap their factory in a silk-local facade so the inferred return type stays portable for consumers — see [the type-portability invariant](#the-type-portability-invariant).

- **Location:** `packages/silk`; one shim file per subpath under `src/`, the two bin shims under `src/bin/`, static assets under `public/`. `private: true` in source; the builder flips it on build.
- **Build:** ESM-only base with two dual-format CJS override entries, via `@savvy-web/bundler` (`packages/silk/savvy.build.ts`). See [How silk builds](#how-silk-builds).
- **Versioning:** independent, but auto-coupled to `@savvy-web/cli`, `@savvy-web/mcp` and `@savvy-web/changelog`. silk declares all three as `workspace:*` source `dependencies`; changesets reads that as their exact current version, so any release of the three pushes silk out of range and auto-PATCH-bumps it (`updateInternalDependencies: patch`), re-pinning the exact version at publish. Because they are source `dependencies`, not `peerDependencies`, silk gets a PATCH rather than a forced major.
- **Dogfooded here:** the repo's `.changeset/config.json`, commitlint, lint-staged, Biome and markdownlint configs all reference `@savvy-web/silk/*`.

The companion Claude Code plugin is documented in [plugin.md](./plugin.md).

## Current State

Implemented and published. Every subpath in the [export map](#export-map) has its shim under `src/` or its asset under `public/`, the two carrier bins ship (savvy-web/systems#631), silk-effects is a declared runtime dependency, the build posture in [How silk builds](#how-silk-builds) is what `savvy.build.ts` ships today, and the facades in [the type-portability invariant](#the-type-portability-invariant) are in place. `__test__/` pins the shim shapes, the externals, the built `bin` map and the Biome asset structure against the built output; `__test__/e2e/bins.e2e.test.ts` spawns the built bins.

## The carrier bins

```jsonc
"bin": { "savvy": "./src/bin/savvy.ts", "savvy-mcp": "./src/bin/savvy-mcp.ts" }
```

`src/bin/savvy.ts` is `import { main } from "@savvy-web/cli/main"; main();` under a shebang; `src/bin/savvy-mcp.ts` is the same over `@savvy-web/mcp/main` with `await main()`. They **mirror** the front ends' own bins — both call the same `main()` — rather than replace them, so a direct install of `@savvy-web/cli` or `npx @savvy-web/mcp` keeps working. The bundler emits them at `dist/dev/pkg/bin/<name>.js`; because cli and mcp are declared dependencies tsdown externalizes them, so the built shim keeps the literal `from "@savvy-web/cli/main"` import. `__test__/externals.test.ts` pins the built manifest's `bin` map and that each shim has exactly that one import.

These two files are the ONE sanctioned exception to the rule that silk never imports `@savvy-web/cli` or `@savvy-web/mcp`: only `src/bin/` may, and nothing else under `src/` does. The whole decision — why a `bin` entry beats a pnpm hoist, why the front ends keep mirrors, what npm's flat layout does with two providers of the same bin name — is in [package-layering.md](../workspace/package-layering.md#the-carrier-decision). Proof from outside the workspace is `e2e/silk`'s packed-install test ([e2e/architecture.md](../e2e/architecture.md)).

## How silk builds

silk is the bundler's most demanding consumer — it drove the per-entry override and node-builtin interop machinery in `../tsdown-plugins/architecture.md`. `packages/silk/savvy.build.ts` is authoritative; its comment headers explain every decision below in full.

**The posture: ESM-only base, force-bundle only the entries an external tool loads via CJS.** silk-effects is ESM-only (its `@effected/*` kit dependencies have no `require` condition), so any entry an external tool `require()`s cannot externalize silk-effects — it must inline it. The base entries are ESM and externalize silk-effects; two per-entry overrides build dual-format and inline it, so only those two pay the inlining cost.

- **Base build is `format: ["esm"]` with `externals: ["source-map-support", "@savvy-web/silk-effects"]`.** `semver` and `typescript` are declared deps tsdown auto-externalizes. `semver` MUST stay external and declared: rolldown cannot emit its circular CJS modules into ESM without an init-order crash, and its importers are the `@changesets/*` packages inside silk-effects' transitive tree (which the CJS overrides bundle), so a source-level grep reads it as unused. `__test__/externals.test.ts` pins this against the built output; do not remove either half.
- **`@savvy-web/silk-effects` is a declared runtime `dependency`.** Nine files under `src/` import it, so silk is honestly "carrier + config shims" and the old devDependency-plus-transform inversion is resolved by declaring the edge. tsdown auto-externalizes a declared dependency (the base ESM entries want that; it is listed in `externals` anyway so the posture survives a manifest edit), which means the two CJS overrides must force it back in with `bundle: ["@savvy-web/silk-effects"]` (tsdown `deps.alwaysBundle`). `@savvy-web/tsdown-plugins` forwards a partition's `bundle` into the dts pass and the prod declarations pass identically to the JS pass, so the dual-format `.cjs` chunk the dts pass re-emits stays inlined too — silk briefly carried an importer-gated `resolveId` workaround for that until the bundler was fixed (`../tsdown-plugins/build-loop.md`). `externals.test.ts` asserts no `.cjs` contains `require("@savvy-web/silk-effects")`.
- **`dtsExternals: ["effect", "@effect/platform"]`** keeps those two as `import`s in the emitted declarations. Inlining effect's cross-module `declare module` augmentations produced TS2320 conflicts when a consumer type-checked silk's dts. Both are declared runtime dependencies so the type imports resolve.
- **Two CJS override entries: `./changesets/changelog` and `./changesets/markdownlint`.** The Changesets CLI loads the changelog formatter via `resolve-from` + `require()`; markdownlint-cli2 `require()`s its custom rules. An ESM-only export makes the CJS resolver throw `ERR_PACKAGE_PATH_NOT_EXPORTED`. Each override sets `format: ["esm", "cjs"]`, `bundleNodeModules: true` and `bundle: ["@savvy-web/silk-effects"]`, so silk-effects and its transitive tree inline into one self-contained `.js`/`.cjs` per entry (a partition does not inherit the base `externals`, and `bundleNodeModules` alone does not bundle a declared dependency). The markdownlint override also sets `bundledPackages: ["@commitlint/types"]` for its own dts; no base entry's declarations reference that package.
- **The dual-format build activates the cjs-default-interop footer and the node-builtin default-interop rewrite** (`../tsdown-plugins/architecture.md`). Without the footer an ESM consumer doing `import(x).default` gets a `{ default, ...named }` wrapper instead of the rules array markdownlint-cli2 `.flat()`s; without the rewrite a transitive `export { default } from "node:process"` crashes the `.cjs` at load.
- **A `jsonc-parser` resolveId plugin steers to its ESM build.** The package publishes no `exports` field, so the CJS overrides would pick up its UMD `main`, whose parameterized `require` rolldown cannot trace. `../changelog/architecture.md` mirrors the same plugin.
- **The manifest transform is an explicit keep-list.** Everything not on it is bundled and stripped. The kept runtime `dependencies` are: the three exact-pinned companions (`cli` and `mcp` are also the externalized targets of the bin shims); `semver`, `effect` and `@effect/platform` (externalized in JS or dts); `@effected/templates` (the `./lint` declarations name kit types — see [the type-portability invariant](#the-type-portability-invariant)); `@effected/commands`, `@effected/git` and `@effected/workspaces` (silk-effects' required peers — silk externalizes silk-effects, so a consumer inherits them and nothing else in the published graph names them; load-bearing even though no `src/` file imports them); and `@savvy-web/silk-effects` itself. The transform calls `defaultManifestTransform` itself to keep the standard strip. `meta: false` — silk is not a documented API surface, so no API Extractor pass.

## The shim contract

A shim is a drop-in replacement: a config file that imported a subpath of one of the retired standalone packages (`@savvy-web/changesets`, `@savvy-web/commitlint`, `@savvy-web/lint-staged`) must work unchanged after swapping the import to the matching `@savvy-web/silk` subpath. Each shim therefore reproduces the **module shape** the tool's loader consumes, not just the symbols:

- `./changesets/changelog` — default export is the `@changesets/types` `ChangelogFunctions` object, built by `Changesets.makeChangelogFunctions({ logMode })` with the mode read from `VITEST`/`GITHUB_ACTIONS` in the shim itself — the shim is a host adapter for the changesets CLI, so the `process.env` read belongs here, not in the engine (`../silk-effects/architecture.md`). The canonical config id `savvy changeset init` writes is now the standalone `@savvy-web/changelog` package (`../changelog/architecture.md`); this shim remains a supported drop-in.
- `./changesets/markdownlint` — default export is the rule array markdownlint-cli2 loads, plus the named rule objects.
- `./changesets/remark` — named exports for every transform plugin, preset and lint rule remark configs import.
- `./commitlint` — default-exports the auto-detecting `CommitlintConfig` facade; `./commitlint/static` default-exports the static config object.
- `./lint` — the full lint-staged consumer surface (handlers, `Preset`, `createConfig`, workspace utils, section/template data). CLI commands are deliberately not re-exported — those are `cli`'s job.

The shim files under `src/` are the single source of truth for the exact reshaping; the contract above is what must stay stable.

## Export map

```text
./changesets                    ← changeset class/services API surface
./changesets/changelog          ← ChangelogFunctions default (CJS override)
./changesets/markdownlint       ← markdownlint-cli2 rules (CJS override)
./changesets/remark             ← remark plugins + presets + lint rules
./commitlint                    ← CommitlintConfig facade + types
./commitlint/static             ← static config default
./commitlint/prompt             ← commitizen adapter
./commitlint/formatter          ← custom error formatter
./lint                          ← handlers / Preset / createConfig / utils
./biome                         ← static public/biome/silk.json asset
./tsconfig/node/root.json       ← Node monorepo ROOT preset
./tsconfig/rspress/website.json ← RSPress SITE preset (browser/SSG)
```

The `exports` field in `package.json` is the authoritative wiring.

## TSConfig convention presets

In the ecosystem-wide TSConfig taxonomy, **silk owns the convention presets — roots plus framework configs** — while the build tools own the lib/build base (`../bundler/architecture.md`). silk's presets are for repos that follow Silk conventions but have no Silk build tool at that package. They ship under `public/tsconfig/**`:

- **`./tsconfig/node/root.json`** — a self-contained Node-24 monorepo ROOT preset for a root where `@savvy-web/bundler` is not a dependency and so cannot extend the bundler base.
- **`./tsconfig/rspress/website.json`** — an RSPress SITE preset aligned with RSPress's official website tsconfig. The load-bearing decision is the **es2023/browser split**: a site runs in the browser plus SSG, not on Node 24, so it targets `es2023` with `noEmit`, `module: esnext` + `moduleResolution: bundler` and `jsx: react-jsx`.

The es2025-vs-es2023 split is why these are silk's job, not the bundler's: the bundler base is a Node-24 library base, wrong for a browser/SSG site.

## Boundaries and invariants

- **silk's library code never imports `@savvy-web/cli` or `@savvy-web/mcp`.** The two bin shims under `src/bin/` are the one sanctioned exception; everything else resolves its logic from `@savvy-web/silk-effects`. The `@e2e/workspace` DAG check permits the L4→L3 manifest edges and the rule is enforced at the source level by review and the `externals.test.ts` single-import assertion.
- **`peerDependencies` declares the real-tool peers; the suite companions ship as exact-pinned `dependencies`.** Every peer is a tool the consumer runs itself (audited entry by entry in `packages/silk/CLAUDE.md`), all via purpose-scoped catalogs. `cli`/`mcp`/`changelog` are NOT peers: publishing them as peers made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions. The bins reach a consumer through silk's own `bin` map; `@savvy-web/pnpm-plugin-silk` no longer hoists `cli`/`mcp` and hoists only `@savvy-web/changelog`, which the changesets engine resolves by id from the consumer root.
- **CJS is required for two entries, not the whole package.** See [How silk builds](#how-silk-builds).
- **The Biome asset is pinned to an exact Biome version in several coupled spots that move together.** `public/biome/silk.json`'s `$schema` URL, the `@biomejs/biome` peer (exact via the `lint` catalog), `@savvy-web/cli`'s `BIOME_VERSION` (`packages/cli/src/commands/lint/biome-version.ts`, which `savvy lint`/`savvy check` sync consumer `$schema` URLs to) and the templates default. `packages/silk/CLAUDE.md` carries the upgrade checklist; `../cli/architecture.md` the sync path.
- **The asset propagates to every consumer repo, so a config key must exist in the OLDEST Biome any consumer runs.** Check a new key against the older schema before adding it; `packages/silk/CLAUDE.md` names the currently ungated newer keys.
- **The asset excludes `.repos`, `.claude/worktrees` and the test-fixture trees, and relaxes `noUndeclaredDependencies` on the test surface** (`__test__/`, `*.test`/`*.spec`, vitest/vite configs). The `.claude/worktrees` exclusion keeps a nested Claude Code worktree from tripping Biome's nested-root abort; the `.repos` exclusion keeps a direct Biome run out of vendored read-only trees. See the `overrides` block in the asset for the authoritative globs.

## The type-portability invariant

A consumer config that infers a silk factory's return type must emit a portable `.d.ts` — its declaration must name the type from `@savvy-web/silk` (a direct dependency), never from `@savvy-web/silk-effects` (transitive). TypeScript names an inferred type from where the function **signature** is declared, so a shim that re-exports the silk-effects class by value leaks the canonical home back to silk-effects and triggers **TS2883** in any `export default CommitlintConfig.silk()` / `Preset.silk()` config.

The fix is a silk-local **facade**: the shim declares the factory's method signatures in silk, annotated with a silk-owned return type, and delegates the body to silk-effects:

- `src/commitlint/index.ts` — an empty-extends `CommitlintUserConfig` interface (structurally identical, auto-syncing, silk-owned) plus a `CommitlintConfig` object whose `silk()` returns it.
- `src/lint/index.ts` — a `Preset` object wrapping the silk-effects statics, each returning silk's `LintStagedConfig` alias.

The facade is behaviorally equivalent: the silk-effects classes have private constructors and only static factories, so consumers never instantiate them. The changesets shims export plain values, not inferred factory results, so they need no facade. The rejected alternative — `dtsBundledPackages: ["@savvy-web/silk-effects"]` — cannot work because API Extractor cannot inline a star-namespace re-export.

**The same invariant reaches past silk's own types: any package a shim's emitted `.d.ts` names must ship as a real silk `dependency`.** silk-effects re-exports nothing from `@effected/*` (`../silk-effects/architecture.md`), so silk's `./lint` declarations reference `@effected/templates` directly, and that package is on both silk's `dependencies` and the build transform's keep-list. `types:check` cannot catch a miss here — it resolves against the workspace's flat `node_modules`; the gate is the dist-level typecheck of the built package (`pnpm ci:build`), which is what to run after widening any shim's exported type closure.

## Consumer model

Install `@savvy-web/silk` → its own `bin` map creates `node_modules/.bin/savvy` and `.bin/savvy-mcp`, its exact-pinned `dependencies` pull `cli`, `mcp` and `@savvy-web/changelog` (the shims' import targets and the changelog id), `autoInstallPeers` pulls the real tools its configs reference, and `@savvy-web/pnpm-plugin-silk`'s hoist keeps `@savvy-web/changelog` resolvable by id → `savvy init` seeds the configs, referencing `@savvy-web/silk/*` shims and `@savvy-web/changelog` as the changelog id, and wires husky hooks to `savvy` subcommands → at runtime both silk (via its shims) and cli (via its handlers) resolve their logic from silk-effects. The Biome preset is referenced as `extends: "@savvy-web/silk/biome"`.

## Rationale

### Why silk holds no logic

The source tools coupled their CLI commands to their config-export modules through shared internal logic, so that logic cannot sit in silk without `cli` importing silk. It lives in silk-effects instead; silk is a config-integration surface plus the bin carrier, cli a pure command host and neither's library code imports the other. See `../silk-effects/architecture.md` and `../cli/architecture.md`.

### Why silk carries the bins

A consumer installs one package. A `bin` entry on that package works under pnpm, npm, yarn and bun with nothing to configure, whereas the previous mechanism — a `publicHoistPattern` shipped by a pnpm config dependency — reached only pnpm consumers who had adopted the plugin. The shims are deliberately mirrors of the front ends' own bins (same `main()`), so nothing about how cli or mcp run changed; only who puts them on PATH did. See [package-layering.md](../workspace/package-layering.md#the-carrier-decision).

### Why nested subpaths, no root barrel

silk is not a library to import wholesale — it is a set of config-integration entry points, each loaded by a different tool. A root barrel would imply a coherent API; the nested subpaths mirror exactly the module shapes the external tools load.
