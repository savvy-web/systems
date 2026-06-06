---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-06-05
last-synced: 2026-06-05
completeness: 92
related:
  - ../cli/architecture.md
  - ../silk-effects/architecture.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/silk architecture

The single package a consumer installs to get the whole Silk Suite dev-tooling system. A thin
config-integration shim surface over `@savvy-web/silk-effects`, plus a static Biome preset asset.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Known issue: non-deterministic rslib bundle](#known-issue-non-deterministic-rslib-bundle)
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
**Build:** dual-format (esm + cjs) via `@savvy-web/rslib-builder`; ships the Biome asset via
`copyPatterns`
**Versioning:** `fixed` changeset group with `@savvy-web/cli` (they always release together)

This package is the result of Silk Core sub-project 1. It replaces the
config-integration subpaths of three standalone packages (`@savvy-web/changesets`,
`@savvy-web/commitlint`, `@savvy-web/lint-staged`) as drop-in equivalents.

## Current State

Implemented and dogfooded inside `systems` (`.changeset/config.json`, commitlint, lint-staged,
biome and markdownlint config reference `@savvy-web/silk/*`). All shims live under `src/`, one file
per subpath; the Biome preset is a copied asset, not a shim. `private: true` in source; the builder
flips it on build.

## Known issue: non-deterministic rslib bundle

silk is still built by `@savvy-web/rslib-builder` (it is M5 of the bundler self-host migration; cli/mcp/silk are the remaining rslib consumers). Its rslib bundle of `effect`'s `Logger.replace` is **non-deterministic under parallel cold builds**: the chunk holding `Logger.replace` occasionally initializes in the wrong order, so loading `@savvy-web/silk/commitlint` throws `replace is not a function` and `@savvy-web/silk/lint` can throw a null `Lint.Handler`. A fresh `rm -rf packages/silk/dist && pnpm --filter @savvy-web/silk build:dev` (a clean serial rebuild) fixes it. This is an rslib/rolldown chunk-init ordering bug, **not** caused by silk-effects' bundled-dts default — silk-effects' JS stays per-module and unchanged (only its declarations are bundled; see `../tsdown-plugins/architecture.md`). Expected to resolve when silk migrates onto `@savvy-web/bundler` at M5.

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
  CJS — notably markdownlint-cli2's custom-rule loader, which loads
  `./changesets/markdownlint` through a CommonJS path. silk is `format: ["esm", "cjs"]` and externals
  `silk-effects`, so silk-effects must also expose a CJS entry for the `require` to resolve. That is
  why both packages build dual-format.

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
