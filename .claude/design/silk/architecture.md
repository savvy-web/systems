---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-06-07
last-synced: 2026-06-07
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

The single package a consumer installs to get the whole Silk Suite dev-tooling system. A thin
config-integration shim surface over `@savvy-web/silk-effects`, plus a static Biome preset asset.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [How silk builds: force-bundle the runtime, externalize types](#how-silk-builds-force-bundle-the-runtime-externalize-types)
- [The Shim Contract](#the-shim-contract)
- [Export Map](#export-map)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [The Type-Portability Invariant](#the-type-portability-invariant)
- [Consumer Model](#consumer-model)
- [Rationale](#rationale)

## Overview

`@savvy-web/silk` is the install surface, not a library. Each subpath export is a thin **shim** that
re-exports `silk-effects` logic shaped into the exact module form an external tool's config loader
expects. The shims carry no business logic — they re-export from the `Changesets`, `Commitlint` and
`Lint` namespaces of `silk-effects` and reshape the export (default vs named, array vs object) to
match what the consuming tool loads. The two config-factory shims (`commitlint`, `lint`) wrap their
factory in a silk-local **facade** so the inferred return type stays portable for consumers — see
[the type-portability invariant](#the-type-portability-invariant).

**Package:** `@savvy-web/silk`
**Location:** `packages/silk` in `savvy-web/systems`
**Build:** dual-format (esm + cjs) via `@savvy-web/bundler` (M5 self-host); ships the Biome asset
through the top-level `public/` convention. See
[How silk builds](#how-silk-builds-force-bundle-the-runtime-externalize-types).
**Versioning:** `fixed` changeset group with `@savvy-web/cli` (they always release together)

This package is the result of Silk Core sub-project 1. It replaces the
config-integration subpaths of three standalone packages (`@savvy-web/changesets`,
`@savvy-web/commitlint`, `@savvy-web/lint-staged`) as drop-in equivalents.

## Current State

Implemented and dogfooded inside `systems` (`.changeset/config.json`, commitlint, lint-staged,
biome and markdownlint config reference `@savvy-web/silk/*`). All shims live under `src/`, one file
per subpath; the Biome preset is a copied `public/` asset, not a shim. `private: true` in source; the
builder flips it on build. silk now builds via `@savvy-web/bundler` (M5) — the rslib builder is gone.
See [How silk builds](#how-silk-builds-force-bundle-the-runtime-externalize-types) for the build
posture that the bundler migration settled on, which is **not** the approach the original plan
described.

## How silk builds: force-bundle the runtime, externalize types

silk's build is the most demanding consumer of the bundler, and reconciling it drove four of the
bundler's M4–M6 capabilities (`bundleNodeModules`, `dtsExternals`, the cjs-default-interop plugin and
the flat-manifest collision guard — see `../tsdown-plugins/architecture.md`). The authoritative
config is `packages/silk/savvy.build.ts`; its comment headers are the source of truth for each
decision below.

**The original plan dead-ended.** The earlier intent (recorded in prior versions of this doc) was to
externalize `@savvy-web/silk-effects` from silk's bundle and have both packages ship dual-format, so
the CJS `require` chain resolved silk-effects' own `.cjs`. That failed: `workspaces-effect` (a
transitive silk-effects dep) is ESM-only, so a CJS `require` of an externalized silk-effects chain
breaks. The shipped approach is the opposite — silk **force-bundles** its runtime into a
self-contained artifact.

- **`bundleNodeModules: true` force-bundles `silk-effects` and its transitive node_modules deps into
  silk's own JS** (esm `.js` + cjs `.cjs`). Nothing in the runtime chain is externalized except the
  three packages below, so a CJS `require("@savvy-web/silk/...")` resolves entirely from silk's own
  bytes with no ESM-only dependency to trip over.
- **`externals: ["typescript", "source-map-support", "semver"]`.** `typescript`/`source-map-support`
  are normal externals. `semver` is externalized specifically because rolldown cannot emit semver's
  circular CommonJS modules (`comparator` ↔ `range`) into ESM output without a
  `require_range is not a function` init-order crash; it is declared as a runtime dependency instead.
- **`dtsExternals: ["effect", "@effect/platform"]` externalizes those two in the DECLARATION pass
  only.** The emitted `.d.ts`/`.d.cts` reference effect's types via `import` rather than inlining
  them, while the JS pass still force-bundles effect. Inlining effect's cross-module
  `declare module` interface augmentations produced conflicting interface-extension errors (TS2320)
  when a consumer type-checked silk's dts. effect and `@effect/platform` are declared as runtime
  dependencies (alongside semver) so consumers can resolve those dts type imports; both expose a
  CJS-resolvable entry so the `require()` path still works. `silk-effects`, `workspaces-effect` and
  `unified` are deliberately NOT in `dtsExternals` — their declarations inline cleanly and they are
  ESM-only, so declaring them as deps would make tsdown externalize them from the JS too and break
  the CJS `require`. They stay bundled in BOTH passes.
- **`bundledPackages: ["@commitlint/types"]` is now DORMANT.** The silk-local commitlint facade (see
  [the type-portability invariant](#the-type-portability-invariant)) means `@commitlint/types` is no
  longer reachable in silk's dts, so the dts-inlining knob has nothing to inline. It is left in the
  config as documentation of intent.
- **The cjs-default-interop plugin is load-bearing for silk's CJS consumers.** rolldown's
  `output.exports` cannot emit `module.exports = <default>` while keeping named exports, so an ESM
  consumer doing `import(x).default` would receive a `{ default, ...named }` wrapper. silk's
  `./changesets/markdownlint` default-exports the rules ARRAY, which markdownlint-cli2 reads as
  `module.default` and `.flat()`s; without the interop footer it gets the wrapper object and aborts.
  The plugin (rslib `cjsInterop` parity) runs automatically because silk builds dual-format — see
  `../tsdown-plugins/architecture.md`.
- **The peerDep promotion transform.** `@savvy-web/cli` and `@savvy-web/mcp` are declared as regular
  `dependencies` in source (so changesets versions them in lockstep with silk; a peerDependency on a
  released workspace package forces a major bump on every minor). The transform promotes them back
  into `peerDependencies` for the published manifest, then keeps ONLY `{semver, effect,
  @effect/platform}` as runtime `dependencies` (the externalized/dts-externalized packages consumers
  must resolve) and strips the rest, since everything else is bundled.

## The Shim Contract

A shim is a drop-in replacement: a config file that previously imported a subpath of one of the
three old packages must work unchanged after swapping the import to the matching `@savvy-web/silk`
subpath. That means each shim must reproduce the **module shape** the tool's loader consumes, not
just re-export symbols:

- `./changesets/changelog` — default export is the `@changesets/types` `ChangelogFunctions` object
  the Changesets CLI loads from `.changeset/config.json`'s `changelog` field. See
  `src/changesets/changelog.ts` (`export default Changesets.changelogFunctions`).
- `./changesets/markdownlint` — default export is the rule array markdownlint-cli2 loads, plus the
  named rule objects. See `src/changesets/markdownlint.ts`.
- `./changesets/remark` — named exports for every transform plugin, preset and lint rule that remark
  configs import. See `src/changesets/remark.ts`.
- `./commitlint/static` — default export is the static config object (no auto-detection). The root
  `./commitlint` default-exports `CommitlintConfig` (the auto-detecting factory, now a silk-local
  facade — see [the type-portability invariant](#the-type-portability-invariant)).
- `./lint` — re-exports the full lint-staged consumer surface (handlers, `Preset`, `createConfig`,
  workspace utils, section/template data). CLI commands are deliberately **not** re-exported here —
  those are `cli`'s job.

The shim files are the single source of truth for the exact reshaping; the contract above is what
must stay stable so external config files do not break.

## Export Map

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
```

The mapping from each old package's subpaths into this tree is the load-bearing decision; see the
`exports` field in `package.json` for the authoritative wiring.

## Boundaries and Invariants

- **`@savvy-web/silk` never imports `@savvy-web/cli`.** Its only dependency is
  `@savvy-web/silk-effects` (`workspace:*`). This is grep-guarded.
- `peerDependencies` declares `@savvy-web/cli` (required, install-wiring) plus the merged real-tool
  peers of the three source packages (`@biomejs/biome` optional, `husky`, `@commitlint/*`,
  `commitizen`, `@changesets/cli`, `lint-staged`, `markdownlint-cli2`, the codequality formatter)
  and the toolchain peers via `catalog:silkPeers`. Installing `silk` pulls the `savvy` bin and all
  the tools its configs reference.
- **Dual-format build is mandatory, not cosmetic.** Some consumers `require()` silk subpaths from
  CJS — notably markdownlint-cli2's custom-rule loader, which loads `./changesets/markdownlint`
  through a CommonJS path. silk is `format: ["esm", "cjs"]` and **force-bundles** its silk-effects
  runtime chain (`bundleNodeModules`) so the `require` resolves from silk's own self-contained bytes
  rather than chasing an ESM-only transitive dep. The dual-format build also activates the
  cjs-default-interop footer that the markdownlint-cli2 default-as-array consumer requires. See
  [How silk builds](#how-silk-builds-force-bundle-the-runtime-externalize-types).

## The type-portability invariant

A consumer config that infers a silk factory's return type must emit a portable `.d.ts` — its
declaration must name the return type from `@savvy-web/silk` (a direct dependency), never from
`@savvy-web/silk-effects` (only a transitive dependency). TypeScript names an inferred type from
where the function **signature** is declared, not where the value is imported, so a shim that simply
re-exports the silk-effects class by value (`export const Preset = Lint.Preset`) leaks the canonical
return type back to silk-effects and triggers **TS2883** ("inferred type cannot be named… likely not
portable") in any `export default CommitlintConfig.silk()` / `export default Preset.silk()` config.

The fix is a silk-local **facade**: each config-factory shim declares the factory's method signatures
in silk itself, annotated with a silk-owned return type, and delegates the body to the silk-effects
implementation. This pins the consumer-visible canonical home to `@savvy-web/silk/*`.

- `commitlint` — `export interface CommitlintUserConfig extends Commitlint.CommitlintUserConfig {}`
  (empty-extends: structurally identical, auto-syncing, silk-owned canonical home) plus a
  `CommitlintConfig` object facade whose `silk(options?)` returns silk's `CommitlintUserConfig`. See
  `src/commitlint/index.ts`.
- `lint` — a `Preset` object facade wrapping all four statics (`minimal`/`standard`/`silk`/`get`),
  each annotated with silk's own `LintStagedConfig` alias. See `src/lint/index.ts`.

The facade is behaviorally equivalent to the silk-effects class: those classes have private
constructors and only static factory methods, so consumers never instantiate or use them as a class
type. The `Changesets`/`Commitlint`/`Lint` namespaces in silk-effects are unchanged and still
consumed by cli/mcp; silk-effects itself is untouched. The changesets shims export plain values, not
an inferred factory return type, so they do not need facades. The rejected alternative —
`dtsBundledPackages: ["@savvy-web/silk-effects"]` — is invalid because API Extractor cannot inline a
star-namespace re-export.

## Consumer Model

Install `@savvy-web/silk` → `autoInstallPeers` pulls `cli` (the `savvy` bin) plus
biome/husky/@commitlint/@changesets/lint-staged/markdownlint → `savvy init` seeds the configs that
reference `@savvy-web/silk/*` and wires husky hooks to `savvy` subcommands → at runtime both `silk`
(via its shims) and `cli` (via its handlers) resolve their logic from `silk-effects`. The Biome
preset is referenced as `extends: "@savvy-web/silk/biome"`.

## Rationale

### Why silk holds no logic

The parent Silk Core spec originally described `silk` as the package that copies and re-organizes
the three tools' source — i.e. silk holds the business logic. Sub-project 1 corrected that: the
source tools couple their CLI commands to their config-export modules through shared internal logic,
so the logic cannot sit in silk without `cli` importing silk. The logic descended into `silk-effects`
instead. silk became a pure config-integration shim surface; `cli` a pure command host; neither
imports the other. See `silk-effects/architecture.md` for the extraction and `cli/architecture.md`
for the command host.

### Why nested subpaths, no root barrel

silk is not a library to import wholesale — it is a set of config-integration entry points each
loaded by a different tool. A root barrel would imply a coherent API; the nested subpaths instead
mirror exactly the module shapes the external tools load.
