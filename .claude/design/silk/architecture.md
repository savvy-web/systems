---
status: current
module: silk
category: architecture
created: 2026-05-31
updated: 2026-05-31
last-synced: 2026-05-31
completeness: 90
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
- [The Shim Contract](#the-shim-contract)
- [Export Map](#export-map)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Consumer Model](#consumer-model)
- [Rationale](#rationale)

## Overview

`@savvy-web/silk` is the install surface, not a library. Each subpath export is a thin **shim** that
re-exports `silk-effects` logic shaped into the exact module form an external tool's config loader
expects. The shims carry no logic — they re-export from the `Changesets`, `Commitlint` and `Lint`
namespaces of `silk-effects` and reshape the export (default vs named, array vs object) to match
what the consuming tool loads.

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
  `./commitlint` default-exports `CommitlintConfig` (the auto-detecting factory).
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
