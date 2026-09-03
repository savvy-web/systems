---
status: current
module: changelog
category: architecture
created: 2026-07-06
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 85
related:
  - ../silk-effects/architecture.md
  - ../silk/architecture.md
  - ../cli/architecture.md
  - ../bundler/architecture.md
  - ../tsdown-plugins/build-loop.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/changelog architecture

The Silk Suite changesets changelog generator as a standalone installable package — the canonical `changelog` id for `.changeset/config.json`. A one-file default re-export of `@savvy-web/silk-effects`' `Changesets.changelogFunctions`; silk-effects is the single source of truth for all changelog logic.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Build posture](#build-posture)
- [Distribution and coupling](#distribution-and-coupling)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/changelog` gives the silk changelog formatter an **installable identity**. A `.changeset/config.json` `changelog` entry is a module id the vanilla changesets CLI resolves with `resolve-from` + `require()` from the consumer's workspace, so the id must be a real, resolvable installed package with a `require` condition.

- **Source:** `packages/changelog/src/index.ts` — the entire package. It default-exports silk-effects' `Changesets.changelogFunctions` (`packages/silk-effects/src/changesets/changelog/index.ts`), annotated with the nominal `ChangelogFunctions` type from `@changesets/types`. The test in `__test__/` asserts the export is reference-identical to the silk-effects object.
- **Build:** dual esm+cjs, self-contained, through the `@savvy-web/bundler` front door (`packages/changelog/savvy.build.ts`). See [Build posture](#build-posture).
- **Versioning:** independent; a release auto-PATCH-bumps `@savvy-web/silk`, which re-pins it as an exact regular dependency. See [Distribution and coupling](#distribution-and-coupling).

## Current State

The package is a single-file re-export (`packages/changelog/src/index.ts`) built and published through the bundler front door, wired into the suite as the changelog id named by `.changeset/config.json`. The three sections that follow describe how it is built, how consumers resolve it and which invariants keep it correct.

## Build posture

`packages/changelog/savvy.build.ts` is the source of truth; its comment headers explain each decision in full. The load-bearing choices:

- **`format: ["esm", "cjs"]` with `bundleNodeModules: true`.** The changesets CLI `require()`s the formatter, and CJS cannot `require()` ESM-only silk-effects, so the CJS artifact inlines silk-effects and its transitive tree. `bundleNodeModules` also collapses the JS pass to one self-contained file per entry — the per-module layout writes inlined deps to sibling files `npm pack` strips from the tarball (the finding is recorded in [the build loop doc](../tsdown-plugins/build-loop.md) under `bundleNodeModules`).
- **`externals: ["jju", "semver"]`, declared as runtime `dependencies`.** Both have circular internal CommonJS requires that crash rolldown's CJS-to-ESM interop when inlined, so they resolve as ordinary installed deps instead. The same `semver` finding lives in `packages/silk/savvy.build.ts`.
- **A `jsonc-parser` resolveId plugin steers to its ESM build.** `jsonc-parser` publishes no `exports` field, so a CJS bundle picks up its UMD `main`, whose relative requires rolldown cannot trace. Mirrors the silk build.

`@savvy-web/silk-effects` is a devDependency (bundled, never a published dep); `meta` is off — the package publishes a formatter module, not a documented API surface.

## Distribution and coupling

Three coordination points make the id resolvable in a consumer workspace without anyone installing it by hand:

- **silk ships it as an exact-pinned dependency.** silk declares `@savvy-web/changelog` as a `workspace:*` source dependency and its build transform (`packages/silk/savvy.build.ts`) keeps it as an EXACT-pinned regular `dependency` in the published manifest — the same mechanism that couples silk to cli and mcp. Changesets reads `workspace:*` as the exact current version, so a changelog release pushes silk's dep out of range, auto-PATCH-bumps silk and re-pins it. See `../silk/architecture.md`.
- **pnpm-plugin-silk public-hoists it** so the changesets CLI, which resolves the id from the workspace root, finds it. The hoist is excluded inside `systems` itself, where the package is a workspace member; the authored list lives in `packages/pnpm-plugin-silk/savvy.build.ts`.
- **cli writes it as canonical.** `savvy changeset init` writes `@savvy-web/changelog` into `.changeset/config.json`. Its config check also accepts the silk shim subpath and the retired `@savvy-web/changesets/changelog` id — see the `CHANGELOG_ENTRY` constants in `packages/cli/src/commands/changeset/commands/init.ts` and `../cli/architecture.md`.

`silk-release-action`'s native versioning bundles this package as its changelog module — a standalone id is bundleable in a no-`node_modules` context in a way a silk subpath shim is not.

## Boundaries and invariants

- **No business logic.** The package is a re-export; every changelog behavior (release lines, dependency tables, GitHub attribution) lives in silk-effects' `Changesets` namespace and is documented in `../silk-effects/architecture.md`. Changing changelog behavior never touches this package.
- **Within the repo it depends only on `@savvy-web/silk-effects`** (as a bundled devDependency), consistent with the suite's topology around silk-effects as the shared core.
- **The default export shape is the contract:** the `@changesets/types` `ChangelogFunctions` object the changesets CLI loads. The export is annotated with that nominal type on purpose — a `typeof` chain through the Effect-typed `Changesets` namespace would make the dts bundler materialize the whole silk-effects + effect type graph into the published declarations for a two-function surface. Drift is caught by the reference-identity test, not by the type.

## Rationale

### Why a standalone package instead of the silk shim

silk's `./changesets/changelog` export (`packages/silk/src/changesets/changelog.ts`) still exists and works, but a subpath of `@savvy-web/silk` is only resolvable where silk itself is installed and hoisted, and it cannot serve as a bundleable changelog module id for silk-release-action, which runs without a consumer `node_modules`. A standalone package name is resolvable anywhere it is installed or hoisted, is the conventional shape for a changesets `changelog` entry and decouples the formatter's identity from silk's install topology.

### Why a re-export instead of moving the logic

Moving `Changesets.changelogFunctions` out of silk-effects would fork the source of truth: cli (`savvy changeset version` via `ReleasePlanner`), silk's shim and mcp all consume the changelog pipeline from silk-effects. A thin re-export keeps one implementation with two identities — the silk-effects namespace for in-suite consumers and the installable package for external `require()` resolution.
