---
status: current
module: changelog
category: architecture
created: 2026-07-06
updated: 2026-07-06
last-synced: 2026-07-06
completeness: 85
related:
  - ../silk-effects/architecture.md
  - ../silk/architecture.md
  - ../cli/architecture.md
  - ../bundler/architecture.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/changelog architecture

The Silk Suite changesets changelog generator as a standalone installable package — the canonical `changelog` id for `.changeset/config.json`. A one-file default re-export of `@savvy-web/silk-effects`' `Changesets.changelogFunctions`; silk-effects remains the single source of truth for all changelog logic.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [How it builds: self-contained dual format](#how-it-builds-self-contained-dual-format)
- [Distribution and coupling](#distribution-and-coupling)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/changelog` exists to give the silk changelog formatter an **installable identity**. A `.changeset/config.json` `changelog` entry is a module id the vanilla changesets CLI resolves with `resolve-from` + `require()` from the consumer's workspace, so the id must be a real, resolvable installed package with a `require` condition. The package's entire source is `src/index.ts`: a default export of `Changesets.changelogFunctions` from silk-effects, typed against silk-effects' own surface so the two cannot drift.

**Package:** `@savvy-web/changelog`, at `packages/changelog` in `savvy-web/systems`.
**Build:** dual esm+cjs, self-contained via `bundleNodeModules`, through the `@savvy-web/bundler` front door. See [How it builds](#how-it-builds-self-contained-dual-format).
**Versioning:** independent; a release auto-PATCH-bumps `@savvy-web/silk`, which pins it as an exact peer. See [Distribution and coupling](#distribution-and-coupling).

## Current State

Implemented and wired across the suite: `savvy changeset init` writes `@savvy-web/changelog` as the canonical `.changeset/config.json` changelog id (see `../cli/architecture.md`), `@savvy-web/silk` ships it as a peer companion alongside cli/mcp (see `../silk/architecture.md`) and `@savvy-web/pnpm-plugin-silk` public-hoists it so the changesets CLI can resolve it from a consumer workspace (excluded from hoisting inside `systems` itself, where it is a workspace package — see `packages/pnpm-plugin-silk/savvy.build.ts`). The test suite asserts the default export is reference-identical to silk-effects' `Changesets.changelogFunctions`.

## How it builds: self-contained dual format

The build posture mirrors silk's `./changesets/changelog` CJS override, applied package-wide. `packages/changelog/savvy.build.ts` is the source of truth; its comment headers document each decision. The topology:

- **`format: ["esm", "cjs"]` + `bundleNodeModules: true`.** The changesets CLI `require()`s the formatter, and CJS cannot `require()` ESM-only silk-effects (its transitive `workspaces-effect` has no `require` condition), so the CJS artifact inlines silk-effects and its transitive tree. `bundleNodeModules` also flips the JS pass to a fully bundled single file, so the packed tarball is genuinely self-contained (see the preserveModules/npm-pack finding in `../tsdown-plugins/architecture.md`).
- **`externals: ["jju", "semver"]`, declared as runtime `dependencies`.** Both are transitive deps of silk-effects' `Changesets` barrel with circular internal CommonJS requires; rolldown's CJS-to-ESM interop wrapper crashes (`require_X is not a function`) when either circular pair is inlined into the esm output — the same finding first hit for `semver` in silk's build. Externalizing them and declaring them as real deps lets normal resolution handle the cycles.
- **A `jsonc-parser` resolveId plugin steers to its ESM build.** `jsonc-parser` publishes no `exports` field, so the CJS bundle resolves its UMD `main`, whose factory receives `require` as a function parameter rolldown cannot trace — its relative requires survive into the output and throw at load time. The plugin rewrites resolution to the `module` ESM build, which bundles cleanly. Mirrors `packages/silk/savvy.build.ts`.

`@savvy-web/silk-effects` is a devDependency (bundled, never a published dep); `meta` is off — the package publishes a formatter module, not a documented API surface.

## Distribution and coupling

Three coordination points make the id resolvable in a consumer workspace without anyone installing it by hand:

- **silk ships it as a peer companion.** silk declares `@savvy-web/changelog` as a `workspace:*` source dependency and its build transform promotes it into an EXACT-pinned `peerDependency` — the same mechanism that couples silk to cli/mcp. A changelog release auto-PATCH-bumps silk and re-pins the peer. See `../silk/architecture.md`.
- **pnpm-plugin-silk public-hoists it** so the changesets CLI (which resolves the id from the workspace root) finds it; the hoist is excluded per-repo where the package is a workspace member. The authored list lives in `packages/pnpm-plugin-silk/savvy.build.ts`.
- **cli writes it as canonical.** `savvy changeset init` writes `@savvy-web/changelog` into `.changeset/config.json`; `savvy check` still accepts the prior silk shim subpath and the pre-merge standalone id. See `../cli/architecture.md`.

silk-release-action's native versioning also bundles this package as its changelog module — a standalone id is bundleable in a no-`node_modules` context in a way a silk subpath shim is not.

## Boundaries and invariants

- **No business logic.** The package is a re-export; every changelog behavior (release lines, dependency tables, GitHub attribution) lives in silk-effects' `Changesets` namespace and is documented there. Changing changelog behavior never touches this package.
- **Within the repo it depends only on `@savvy-web/silk-effects`** (as a bundled devDependency), consistent with the suite's topology around silk-effects as the shared core.
- **The default export shape is the contract:** the `@changesets/types` `ChangelogFunctions` object the changesets CLI loads. The type annotation against `Changesets.changelogFunctions` keeps it drift-proof.

## Rationale

### Why a standalone package instead of the silk shim

silk's `./changesets/changelog` shim still exists and works, but a subpath of `@savvy-web/silk` is only resolvable where silk itself is installed and hoisted — and it cannot serve as a bundleable changelog module id for silk-release-action's native versioning, which runs without a consumer `node_modules`. A standalone package name is resolvable anywhere it is installed or hoisted, is the conventional shape for a changesets `changelog` entry and decouples the formatter's identity from silk's install topology.

### Why a re-export instead of moving the logic

Moving `Changesets.changelogFunctions` out of silk-effects would fork the source of truth: cli (`savvy changeset version` via `ReleasePlanner`), silk's shim and mcp all consume the changelog pipeline from silk-effects. A thin re-export keeps one implementation with two identities — the silk-effects namespace for in-suite consumers and the installable package for external `require()` resolution.
