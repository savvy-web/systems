---
status: current
module: e2e
category: testing
created: 2026-06-30
updated: 2026-06-30
last-synced: 2026-06-30
completeness: 90
related:
  - ../tsdown-plugins/architecture.md
  - ../bundler/architecture.md
  - ../pnpm-plugin-silk/architecture.md
dependencies:
  - ../tsdown-plugins/architecture.md
  - ../pnpm-plugin-silk/architecture.md
---

# e2e harness architecture

The `e2e/*` workspace area holds private, never-published harness packages that exercise the repo's build tooling the way a real consumer does: by spawning the actual built tool as a subprocess against an isolated fixture repo. Its reason to exist is catalog/workspace specifier resolution — that resolution roots at `process.cwd()`, so the only faithful and hermetic way to test it is to run the real tool with `cwd` pointed at a fixture that owns its own `pnpm-workspace.yaml`.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The problem it solves](#the-problem-it-solves)
- [The solution: subprocess against isolated fixtures](#the-solution-subprocess-against-isolated-fixtures)
- [Fixture isolation invariant](#fixture-isolation-invariant)
- [Coverage: two fidelity tiers](#coverage-two-fidelity-tiers)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Gotchas worth remembering](#gotchas-worth-remembering)
- [Rationale](#rationale)

## Overview

`e2e/*` is a top-level pnpm workspace glob (see `e2e/*` in `pnpm-workspace.yaml`) holding two harness packages: `@e2e/bundler` and `@e2e/pnpm-plugin-silk`. Both are `private: true` and never published. Each declares the package(s) under test as `workspace:*` devDependencies, so on install they link the real built `dist/dev` artifact — the harness consumes the package exactly as a downstream repo would, through its published entry points, not its source.

Tests live under `e2e/<pkg>/__test__/e2e/`. They are discovered by the existing `AgentPlugin.discover()` run and execute in the normal `pnpm test` gate — there is no separate vitest project and no separate CI job. The bundler harness spawns `node savvy.build.ts` (or `escape-build.ts`) inside a fixture and asserts on the emitted artifacts; the pnpm-plugin harness imports the built `pnpmfile.mjs` and asserts the config-dependency hook output.

## Current State

Both harness packages are implemented and green in the normal test gate. `@e2e/bundler` carries the subprocess-build fixtures (`leaf`, `leaf-escape`, `multi`, `multitarget`, `catalog-consumer`, `catalog-unknown`, `meta-prod`) and the spawn helper in `e2e/bundler/__test__/e2e/helpers.ts`. `@e2e/pnpm-plugin-silk` carries the single contract test `pnpmfile-contract.e2e.test.ts`. These tests replace integration tests that were deleted because they resolved specifiers against the live host workspace (see below).

## The problem it solves

Several deleted integration tests resolved `catalog:`/`workspace:` specifiers against the LIVE host workspace. They reached resolution through `@savvy-web/tsdown-plugins`' `resolveManifest` (`packages/tsdown-plugins/src/catalog/resolve-catalogs.ts`), which delegates to `workspaces-effect`'s `CatalogResolver`. The resolver discovers the workspace root from `process.cwd()` — it takes no cwd argument.

That worked while the repo consumed `@savvy-web/pnpm-plugin-silk` as a `configDependencies` entry. After the plugin was migrated in-repo (the `configDependencies` entry removed, catalogs materialized inline), in-process resolution against the host hung: the CI test step ran ~24 minutes with 9 timeouts. It was also architecturally wrong — tests for the resolver must not depend on the host repo's own config-dependency or catalog state. The fix is to stop resolving against the host at all.

## The solution: subprocess against isolated fixtures

The harness spawns the ACTUAL built tool as a child process with `cwd` set to a fixture repo. Because `CatalogResolver` reads `process.cwd()`, resolution roots at the fixture and never climbs to the host. This needs no `workspaces-effect` API change and no `chdir` in the test process for the subprocess path — the child simply inherits its own `cwd`, and the package is exercised as a consumer uses it.

The spawn discipline lives in `e2e/bundler/__test__/e2e/helpers.ts`: `runFixtureBuild(fixture, args)` clears the fixture's `dist/`, then `execFileSync("node", ["savvy.build.ts", ...args], { cwd, env: SPAWN_ENV })`. Tests that need a non-default invocation (the unknown-catalog negative test, the escape-hatch `escape-build.ts`) call `execFileSync` directly with the same `SPAWN_ENV` and `fixtureDir(...)`. See the file for the exact shape — it is the single source of the spawn contract.

## Fixture isolation invariant

Each fixture that triggers resolution has its OWN `pnpm-workspace.yaml` carrying inline catalogs and/or a `packages:` glob with sibling stubs. The resolver's root-walk stops at the fixture's `pnpm-workspace.yaml` instead of climbing to the monorepo root — this is the load-bearing isolation guarantee.

Fixtures live under `e2e/<pkg>/__test__/e2e/fixtures/<name>/`. They are test DATA, not workspace members: the `e2e/*` glob matches only the two harness packages, not the nested fixtures, so pnpm never treats a fixture (or its `packages/*` siblings) as part of the real workspace. Fixtures are biome-ignored.

## Coverage: two fidelity tiers

The deleted integration coverage is reconstituted at two distinct fidelities.

**Tier 1 — `@e2e/bundler` (build mechanics via real subprocess builds).** Inline-catalog fixtures plus real `node savvy.build.ts` runs cover: leaf/multi/multitarget build mechanics (`build.e2e.test.ts`); escape-hatch byte-parity, where the raw `tsdown.config.ts` path (`escape-build.ts`) must produce a `pkg/` manifest byte-identical to the front door (`escape-hatch.e2e.test.ts`); catalog/workspace resolution through a build, asserting the emitted manifest contains no residual `catalog:`/`workspace:` specifiers (`catalog-build.e2e.test.ts`); the meta build with real API Extractor, made self-contained by a local `@fixture/*` sibling under the fixture's own `packages/` so the merge has a real workspace dependency to resolve; and an unknown-catalog negative test asserting a non-zero exit whose stderr is catalog-related rather than an unrelated crash.

**Tier 2 — `@e2e/pnpm-plugin-silk` (config-dependency hook OUTPUT contract).** `pnpmfile-contract.e2e.test.ts` imports the built `pnpmfile.mjs` directly and asserts that `hooks.updateConfig({})` injects the `silk`/`silkPeers` catalogs, the overrides, the public hoist pattern and the security defaults. It also asserts the package's main `catalogs` export exposes the same catalogs. This is the contract level, NOT a full pnpm `configDependencies` install: a registry-free install proved impossible because pnpm requires a registry plus integrity, so the chosen approach validates the hook's output shape and leaves the pnpm install/replay half to `workspaces-effect`, where it is unit-tested.

## Boundaries and Invariants

- Harness packages are `private: true`, never published, and depend on the package under test via `workspace:*` so they link the real built `dist/dev` artifact (built on install).
- The subprocess `cwd` is always a fixture dir; the test process never `chdir`s for the subprocess path.
- Every fixture that triggers resolution owns a `pnpm-workspace.yaml`; the `e2e/*` glob never matches a fixture or its siblings.
- Tests run in the normal `pnpm test` gate via `AgentPlugin.discover()` — no separate vitest project, no separate CI job.
- The pnpm-plugin tier asserts hook OUTPUT only; the install/replay half is `workspaces-effect`'s concern.

## Gotchas worth remembering

**`emitManifest` resolves unconditionally for prod groups.** `packages/tsdown-plugins/src/manifest/emit-manifest.ts` calls `resolveManifest(pkg)` in `generateBundle` whenever the target group is prod (or `devManifest === "resolve"`), using `process.cwd()`. So ANY in-process unit test that drives `emitManifest`'s `generateBundle` for a prod group resolves against the host — the exact trap the e2e harness was created to avoid. Real builds dodge it because they run as subprocesses with `cwd` set to the package dir. The one in-process unit test that hit it (`packages/tsdown-plugins/__test__/build/build-target-groups.test.ts`) was made hermetic by `chdir`-ing into a temp dir that has its own empty `pnpm-workspace.yaml` and restoring the prior `cwd` in `finally`. Recommended follow-up: guard `emit-manifest` to skip `resolveManifest` when a manifest has no `catalog:`/`workspace:` specifiers — a behavior-preserving optimization that also speeds real builds.

**Subprocess coverage races vitest's V8 provider.** Spawned builds inherit `NODE_V8_COVERAGE` and write coverage temp files that race vitest's V8 coverage provider, producing intermittent `coverage/.tmp/*.json` ENOENT and an exit-1 even when every test passes. The harness strips `NODE_V8_COVERAGE` from the spawned env via the shared `SPAWN_ENV` in `e2e/bundler/__test__/e2e/helpers.ts`; every `execFileSync` in the harness must pass that env.

## Rationale

The host repo cannot be a fixture for its own resolver tests. Once the catalogs that resolution reads are the host's own live config, the test asserts against a moving target and couples to the repo's config-dependency state — which is exactly what changed when `@savvy-web/pnpm-plugin-silk` migrated in-repo and broke the old tests. Spawning the real built tool against a fixture that owns its workspace root makes the test both hermetic (resolution can only see fixture catalogs) and high-fidelity (it runs the published artifact through the same entry point a consumer would). The subprocess boundary is not incidental — it is what makes `process.cwd()`-based resolution testable without an API change to `workspaces-effect`.
