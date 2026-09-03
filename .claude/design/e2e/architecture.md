---
status: current
module: e2e
category: testing
created: 2026-06-30
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ../bundler/architecture.md
  - ../tsdown-plugins/architecture.md
  - ../pnpm-plugin-silk/architecture.md
  - ../testing/effect-vitest.md
dependencies:
  - ../tsdown-plugins/architecture.md
  - ../pnpm-plugin-silk/architecture.md
---

# e2e harness architecture

The `e2e/*` workspace area holds private, never-published harness packages that exercise the repo's build and release tooling the way a real consumer does: through the BUILT `dist/dev` artifact, against an isolated fixture repo. Its reason to exist is `catalog:`/`workspace:` specifier resolution. That resolution roots at `process.cwd()`, so the only faithful and hermetic way to test it is to run the real tool with `cwd` pointed at a fixture that owns its own `pnpm-workspace.yaml`.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Isolation model](#isolation-model)
- [Harness packages and coverage tiers](#harness-packages-and-coverage-tiers)
- [Fixture taxonomy](#fixture-taxonomy)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Gotchas](#gotchas)
- [Rationale](#rationale)
- [Related Documentation](#related-documentation)

## Overview

`e2e/*` is a top-level glob in `pnpm-workspace.yaml` matching two harness packages, `@e2e/bundler` and `@e2e/pnpm-plugin-silk`. Both are `private: true`. Each declares the package(s) under test as `workspace:*` devDependencies, so on install they link the real built `dist/dev` artifact and consume it exactly as a downstream repo would — through the published entry points, never the source tree.

Tests live under `e2e/<pkg>/__test__/e2e/`. `AgentPlugin.discover()` picks them up as ordinary vitest projects, so they run in the normal `pnpm test` gate with no separate project definition and no separate CI job. `vitest.config.ts` at the repo root gives every `@e2e/*` project `fileParallelism: false`, because the subprocess builds write into shared fixture `dist/` directories, and excludes `**/dist/**` from coverage so the built bundles the harness imports in-process are never instrumented.

## Current State

Both harness packages are green in the normal test gate. `@e2e/bundler` spawns the built `@savvy-web/bundler` front door (and its raw-tsdown escape hatch) inside subprocess fixtures; `@e2e/pnpm-plugin-silk` imports the built `pnpmfile.mjs` and spawns the built `savvy` binary. Neither package has a runtime of its own — everything under `e2e/` is test code plus fixture data.

## Isolation model

Resolution reaches `@effected/workspaces`' `CatalogResolver` through `@savvy-web/tsdown-plugins`' `resolveManifest` (`packages/tsdown-plugins/src/catalog/resolve-catalogs.ts`) and, on the release side, through silk-effects' `Changesets.DepsRegen` (`packages/silk-effects/src/changesets/services/deps-regen.ts`). The resolver discovers the workspace root from `process.cwd()` and takes no cwd argument.

The harness therefore spawns the ACTUAL built tool as a child process with `cwd` set to a fixture. The child inherits its own cwd, resolution roots at the fixture and never climbs to the host, and the test process never has to `chdir`. This needs no API change in `@effected/workspaces`.

Each fixture that triggers resolution owns a `pnpm-workspace.yaml` carrying inline catalogs and/or a `packages:` glob with sibling stubs. The resolver's root-walk stops at that file instead of climbing to the monorepo root — this is the load-bearing isolation guarantee. Fixtures are test DATA, not workspace members: the `e2e/*` glob matches only the two harness packages, never a nested fixture or its `packages/*` siblings, and the shared Biome config (`packages/silk/public/biome/silk.json`) excludes `__test__/**/fixtures`.

The spawn contract lives in `e2e/bundler/__test__/e2e/helpers.ts` (`runFixtureBuild`, `fixtureDir`, `SPAWN_ENV`). It is the single source of that contract; tests that need a non-default invocation call `execFileSync` directly but still pass `SPAWN_ENV` and a `fixtureDir(...)` cwd.

## Harness packages and coverage tiers

**Tier 1 — `@e2e/bundler` (build mechanics via real subprocess builds).** Each test spawns `node savvy.build.ts` (or a variant build script) in a fixture and asserts on the emitted artifacts. `build.e2e.test.ts` covers the leaf, multi-entry and multi-target build shapes; `escape-hatch.e2e.test.ts` proves the raw `tsdown.config.ts` path emits a `pkg/` manifest byte-identical to the front door; `catalog-build.e2e.test.ts` proves `catalog:`/`workspace:` specifiers are rewritten to concrete versions in the emitted manifest, that an unknown catalog fails the build with a catalog-related error and that the meta build resolves a real workspace sibling through API Extractor; `bundle-node-modules.e2e.test.ts` covers the `bundleNodeModules` posture (see `../bundler/architecture.md`) with a node_modules dependency the host packages never declare.

**Tier 2 — `@e2e/pnpm-plugin-silk` (config-dependency hook OUTPUT contract).** `pnpmfile-contract.e2e.test.ts` imports the built `pnpmfile.mjs` and asserts that `hooks.updateConfig({})` injects the `silk`/`silk:peers` catalogs, the overrides, the public hoist pattern and the security defaults, that the package's main `catalogs` export exposes the same catalogs and that the retired camelCase `*Peers` catalog names stay absent from both surfaces. This is the contract level, NOT a full pnpm `configDependencies` install: a registry-free install is not possible because pnpm requires a registry plus integrity, so the harness validates the hook's output shape and leaves the install/replay half to `@effected/workspaces`, where it is unit-tested.

**Tier 2b — `@e2e/pnpm-plugin-silk` (real `CatalogResolver` via the spawned `savvy` binary).** `regen-catalog.e2e.test.ts` closes the gap the other tiers leave: `Changesets.DepsRegen` is unit-tested only against a mocked resolver. The test copies the `regen-catalog` fixture into a `mkdtempSync` dir OUTSIDE the repo, `git init`s it as the base commit, edits the working tree to add `catalog:`/`workspace:`/dev dependencies, then spawns the built `@savvy-web/cli` binary (`savvy changeset deps regen`) with `cwd` set to that dir. It asserts the emitted changeset carries concrete resolved versions rather than protocol strings and no `devDependency` rows, that `savvy changeset check` passes and that the file lints clean through the same `@savvy-web/silk/changesets/markdownlint` custom-rule path the pre-commit hook uses. The `savvy` binary and the silk rules resolve through the root `devDependencies` links, not the harness manifest.

## Fixture taxonomy

Fixtures live under `e2e/<pkg>/__test__/e2e/fixtures/<name>/`. Each `savvy.build.ts` imports the built package (`import { build } from "@savvy-web/bundler"`), never a relative `src` path. The set, and what each exists to prove:

| Fixture | Harness | Proves |
| :------ | :------ | :----- |
| `leaf` | bundler | Single-entry dev and prod build, version injection |
| `leaf-escape` | bundler | Escape-hatch parity (`escape-build.ts` vs `savvy.build.ts`) |
| `multi` | bundler | Multi-entry output mirrors source, no shared chunk |
| `multitarget` | bundler | One folder per distinct target name plus binding |
| `catalog-consumer` | bundler | `catalog:`/`workspace:` rewritten via a fixture-owned workspace root |
| `catalog-unknown` | bundler | Unknown catalog name fails the build with a catalog-related error |
| `meta-prod` | bundler | Meta build with real API Extractor, local `@fixture/*` sibling, optimistic rewrite |
| `bundle-node-modules` | bundler | `bundleNodeModules` inlining vs a declared external (`externals-build.ts`) |
| `regen-catalog` | pnpm-plugin-silk | Real-resolver `deps regen` from a git-initialised temp copy |

Add a fixture whenever coverage needs a dependency resolved from a real consumer context; that coverage does not belong in `packages/<pkg>/__test__/`, where it would resolve against the host.

## Boundaries and invariants

- Harness packages are `private: true`, never published and depend on the package under test via `workspace:*` so they link the built `dist/dev` artifact (populated by that package's own `prepare` build on install).
- The subprocess `cwd` is always a fixture dir; the test process never `chdir`s for the subprocess path.
- Every fixture that triggers resolution owns a `pnpm-workspace.yaml`; the `e2e/*` glob never matches a fixture or its siblings.
- Every spawn passes `SPAWN_ENV` (see [Gotchas](#gotchas)).
- Tests run in the normal `pnpm test` gate via `AgentPlugin.discover()`, serialised per project — no separate vitest project, no separate CI job.
- `pnpmfile-contract` asserts hook OUTPUT only; `regen-catalog` is the one test that exercises the real `CatalogResolver` end-to-end, and it does so from a temp dir outside the repo.

## Gotchas

**In-process prod manifests still resolve against the host.** `buildEmittedManifest` in `packages/tsdown-plugins/src/manifest/emit-manifest.ts` calls `resolveManifest` for any prod group (or `devManifest === "resolve"`) whose manifest carries a `catalog:`/`workspace:` specifier — `manifestNeedsCatalogResolution` skips the resolver otherwise. So an in-process unit test that drives a prod group with such specifiers resolves from `process.cwd()`, the exact trap the harness exists to avoid. Real builds dodge it because they run as subprocesses in the package dir. The hermetic pattern for a unit test that cannot subprocess is to `chdir` into a temp dir holding its own empty `pnpm-workspace.yaml` and restore the prior cwd in `finally`; see `packages/tsdown-plugins/__test__/build/build-target-groups.test.ts`.

**`@e2e/bundler` pins `typescript: ^6.0.3`, not `catalog:silk`.** The `leaf-escape` fixture resolves tsdown through `e2e/bundler`'s node_modules, and rolldown-plugin-dts auto-selects its native "tsgo" dts generator when the peer-resolved TypeScript major is 7 or above. That generator breaks on the tmpdir-written resolved tsconfig (TS6059, declarations leaking into the fixture's `src/`). The front door is unaffected because tsdown-plugins pins TS6 and the `tsc` generator explicitly (see `../tsdown-plugins/architecture.md`); the harness pin keeps the escape hatch on the same footing. Revisit at TS 7.1.

**Subprocess coverage races vitest's V8 provider.** A spawned build that inherits `NODE_V8_COVERAGE` writes coverage temp files that race vitest's collector, producing an intermittent `coverage/.tmp/*.json` ENOENT and an exit-1 even when every test passes. `SPAWN_ENV` strips the variable; the pnpm-plugin-silk harness builds the same env locally because it does not import the bundler helpers.

## Rationale

The host repo cannot be a fixture for its own resolver tests. Once the catalogs that resolution reads are the host's own live config, the test asserts against a moving target and couples to the repo's config-dependency state — a coupling that broke the previous in-package integration tests when `@savvy-web/pnpm-plugin-silk` moved in-repo. Spawning the real built tool against a fixture that owns its workspace root makes the test both hermetic (resolution can only see fixture catalogs) and high-fidelity (it runs the published artifact through the entry point a consumer uses). The subprocess boundary is not incidental — it is what makes `process.cwd()`-based resolution testable without an API change in `@effected/workspaces`.

## Related Documentation

- `../bundler/architecture.md` — the front door the Tier 1 fixtures spawn, and why the bundler's own integration fixtures import source rather than the built package.
- `../tsdown-plugins/architecture.md` — `resolveManifest`, `emitManifest` and the TypeScript 6 pin the harness mirrors.
- `../pnpm-plugin-silk/architecture.md` — the config dependency whose built `pnpmfile.mjs` Tier 2 asserts against.
- `../testing/effect-vitest.md` — suite-wide test conventions; the harnesses run no Effect in-process and stay on plain `vitest`.
