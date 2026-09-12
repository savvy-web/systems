---
status: current
module: workspace
category: architecture
created: 2026-09-12
updated: 2026-09-12
last-synced: 2026-09-12
completeness: 92
related:
  - ./install-orchestration.md
  - ../silk/architecture.md
  - ../silk/plugin.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
  - ../mcp/decision-effect-native.md
  - ../silk-effects/architecture.md
  - ../silk-effects/kit-peer-dependencies.md
  - ../silk-core/architecture.md
  - ../changelog/architecture.md
  - ../pnpm-plugin-silk/architecture.md
  - ../e2e/architecture.md
dependencies:
  - ./install-orchestration.md
---

# Package layering and the carrier pattern

The strict layered graph the Silk app packages form, the `./main` entry contract every front end exposes, and why `@savvy-web/silk` — not a pnpm hoist — is what puts the `savvy` and `savvy-mcp` bins on a consumer's PATH. Implements savvy-web/systems#631; the sibling decision for the MCP server is [mcp/decision-effect-native.md](../mcp/decision-effect-native.md) (#632).

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The layer table](#the-layer-table)
- [The `./main` entry contract](#the-main-entry-contract)
- [The carrier decision](#the-carrier-decision)
- [The silk and silk-effects inversion](#the-silk-and-silk-effects-inversion)
- [Dependencies versus peers](#dependencies-versus-peers)
- [The engine boundary](#the-engine-boundary)
- [The DAG check](#the-dag-check)
- [Hoist removal and release sequencing](#hoist-removal-and-release-sequencing)
- [The root depends on silk only](#the-root-depends-on-silk-only)
- [Known gaps](#known-gaps)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

Before this work the app packages had a flat "everything depends on silk-effects" shape with two soft spots: the `savvy`/`savvy-mcp` bins reached a consumer only because `@savvy-web/pnpm-plugin-silk` public-hoisted `@savvy-web/cli` and `@savvy-web/mcp` (a pnpm-only mechanism that a yarn/npm/bun consumer never got), and silk consumed silk-effects through a devDependency the build transform re-injected into the published manifest. The restructure names four acyclic layers, makes the carrier own its bins through ordinary `bin` entries, declares the real runtime edges, and pins the whole thing with a test that reads the manifests off disk.

The pattern is borrowed from `okfit` (a sibling repo with the same plugin/cli/mcp shape); the differences are called out where they exist.

## Current State

Shipped on `feat/mpc-cli-refactor`: `@savvy-web/silk-core` exists as L1, silk owns both bins, `e2e/workspace` asserts the graph on every `pnpm test`, and pnpm-plugin-silk no longer hoists cli or mcp. `e2e/workspace/layers.json` is the single source of truth for layer membership; the table below is a rendering of it, not a second authority.

## The layer table

```text
L4  @savvy-web/silk                      carrier + config shims (deps on L3 + L2; bins over ./main)
L3  @savvy-web/cli   @savvy-web/mcp      peer front ends (bin / main / index)
    @savvy-web/changelog                 leaf identity (bundles L2 for the changesets CLI)
L2  @savvy-web/silk-effects              engine: services, programs, envelopes
L1  @savvy-web/silk-core                 domain model: schemas, errors, pure contracts
--- tooling band (build-time only; any layer may devDepend on it; it depends on no app layer) ---
    @savvy-web/bundler  @savvy-web/tsdown-plugins  @savvy-web/rspress-builder
    @savvy-web/templates  @savvy-web/github-action-builder  @savvy-web/pnpm-plugin-silk
--- harness band (private, may depend on anything) ---
    @e2e/*
```

The rules, each enforced by [the DAG check](#the-dag-check):

- An edge (`dependencies`, `peerDependencies` or `devDependencies`, `workspace:*` only) may point from a higher layer to a strictly lower one, or from any layer into the tooling band.
- Packages in the same layer never reference each other. In particular `cli`, `mcp` and `changelog` are peers: the historical cli↔silk↔mcp non-import invariant is now a consequence of the layering, with one sanctioned exception described under [the carrier decision](#the-carrier-decision).
- A tooling package never references an app-layer package.
- The harness band is unconstrained (it exists to exercise everything).
- The whole workspace graph topologically sorts.

`silk-effects` re-exports every `silk-core` symbol under the same name, so a consumer of the engine sees one surface; only the layer edge is new. What moved and why is in [silk-core/architecture.md](../silk-core/architecture.md).

## The `./main` entry contract

Each front end splits its process entry into three files with distinct jobs:

| File | Export | Job |
| --- | --- | --- |
| `src/bin.ts` | none (`bin` target) | `#!/usr/bin/env node`, imports `main` and calls it. Nothing else, ever. |
| `src/main.ts` | `main` at `./main` | Owns the process: runtime assembly, crash guards, `NodeRuntime.runMain`. |
| `src/index.ts` | the library barrel at `.` | Importable with no side effects. Never exports `main`. |

`@savvy-web/cli/main` exports `main(): void` (`Command.run(rootCommand)` provided with `AppLive`). `@savvy-web/mcp/main` exports `main(): Promise<void>`; it registers `uncaughtException` / `unhandledRejection` handlers first and only then dynamically imports the server graph, so an import-time failure is caught by a handler rather than crashing before one exists. Both manifests carry `exports["./main"]` and `exports["./package.json"]` alongside `.`; both keep their own `bin` entry pointing at `bin.ts`. The old `runCli` export left cli's barrel with this split — the process owner is the subpath, not the barrel.

The contract is what makes the carrier possible: a shim in another package can import `main` and call it without pulling anything the barrel exports and without double-registering process guards.

## The carrier decision

`@savvy-web/silk` is the one package a consumer installs, so it owns the bin entries:

```jsonc
"bin": { "savvy": "./src/bin/savvy.ts", "savvy-mcp": "./src/bin/savvy-mcp.ts" }
```

Each shim is `import { main } from "@savvy-web/cli/main"; main();` (respectively `await main()` over `@savvy-web/mcp/main`) under a shebang — four lines of code. Installing silk alone creates `node_modules/.bin/savvy` and `.bin/savvy-mcp` off that single direct dependency under every package manager, with no hoist pattern, no `.npmrc` and no config dependency. The built shims keep the literal `from "@savvy-web/cli/main"` import (cli and mcp are declared deps, so tsdown externalizes them); `packages/silk/__test__/externals.test.ts` pins the built manifest's `bin` map and each shim's single import.

The front ends **keep their own bins as mirrors**, not alternatives: `@savvy-web/cli`'s `bin.ts` and silk's `src/bin/savvy.ts` call the same `main()`. This is what makes npm's flat layout acceptable — under npm the `.bin` symlinks may resolve to cli's or mcp's own file rather than silk's shim (pnpm's isolated layout links silk's). The requirement is "bins off the single silk dependency with no hoist config", which holds under both; only pnpm proves it is *silk's* shim doing it, and `e2e/silk`'s packed-install test asserts the stronger claim for pnpm only.

The shims are the ONE sanctioned exception to the non-import invariant: `packages/silk/src/bin/` is the only place silk may import `@savvy-web/cli` or `@savvy-web/mcp`, and nothing else under `src/` may. Library code in the three packages still never imports a sibling.

Proof lives at two tiers: `packages/silk/__test__/e2e/bins.e2e.test.ts` spawns the bins straight out of `packages/silk/dist/dev/pkg/bin/`; `e2e/silk/__test__/e2e/packed-install.e2e.test.ts` packs the six app packages and installs only silk's tarball into a scratch project outside the workspace under pnpm and npm (see [e2e/architecture.md](../e2e/architecture.md#tier-3--e2esilk)).

## The silk and silk-effects inversion

The plan considered making silk a *pure* carrier with silk-effects extracted into a fixtures package. It is not one: nine files under `packages/silk/src/` import `@savvy-web/silk-effects` (the config shims re-shape engine exports for external tool loaders), so the runtime need is real. The inversion is resolved by **declaring the edge honestly**: `@savvy-web/silk-effects` is a regular `dependencies` entry of silk, not a devDependency the build transform re-injects. silk is "carrier + config shims".

Declaring it had one build consequence. tsdown auto-externalizes declared dependencies even under `bundleNodeModules`, so the two CJS override entries (`./changesets/changelog`, `./changesets/markdownlint`) that must inline ESM-only silk-effects carry `bundle: ["@savvy-web/silk-effects"]` (tsdown `deps.alwaysBundle`). The dts pass and the prod declarations pass initially dropped that partition-level `bundle`, so the dual-format `.cjs` chunk the dts pass re-emits still `require()`d silk-effects; silk shipped a scoped `resolveId` workaround for one commit, then `@savvy-web/tsdown-plugins`' `buildTargetGroups` was fixed to forward `bundle` into all three passes identically and the workaround was deleted. The fix landed at the right layer instead of leaving a per-package plugin; `externals.test.ts` asserts no `.cjs` contains `require("@savvy-web/silk-effects")`. See [bundler/build-options.md](../bundler/build-options.md) and [tsdown-plugins/build-loop.md](../tsdown-plugins/build-loop.md).

## Dependencies versus peers

Two rules decide where an entry goes:

- **A peer is a tool the consumer runs itself.** silk's `peerDependencies` were audited entry by entry (`packages/silk/CLAUDE.md`, "Peer audit"); every one — biome, changesets, commitlint, husky, lint-staged, markdownlint-cli2, turbo, typescript, tsx, vitest/vite and their `@types`/ coverage companions — is invoked by the consumer's own scripts or hooks. None moved. cli, mcp and changelog are deliberately NOT peers: publishing them as peers made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions. They ship as exact-pinned regular `dependencies` (source `workspace:*`, which changesets reads as the exact current version).
- **Load-bearing dependencies stay even when no source file imports them.** The `dependencies` blocks of silk, cli and mcp list `@effected/commands`, `@effected/git`, `@effected/workspaces` and `effect` although few or no files under `src/` import them directly: they satisfy `@savvy-web/silk-effects`' required peers (see [kit-peer-dependencies.md](../silk-effects/kit-peer-dependencies.md)). Removing one breaks installs — silently duplicated kit copies under pnpm's `autoInstallPeers`, `ERR_MODULE_NOT_FOUND` under yarn — not any lint pass, so a "remove unused dependency" cleanup must check the peer graph first. silk's build transform keeps them on its explicit published-manifest allowlist for the same reason.

`@effected/workspaces` is a peer of silk-core as well as silk-effects, for class identity; that decision is in [silk-core/architecture.md](../silk-core/architecture.md#effectedworkspaces-is-a-peer).

## The engine boundary

silk-effects is the engine both front ends run, so a `process` read there bakes one host's environment into the other. `packages/silk-effects/__test__/boundaries.test.ts` walks `src/` with silk-core's tokenizer scanner and fails on any file that touches the `process` identifier in code. There is **no per-file allowlist**. The one carve-out is two top-level directories skipped by name — `lint/` and `commitlint/` — because they are **host adapters**: entry points invoked by lint-staged, markdownlint-cli2 and commitlint, foreign host processes that supply no context, so they must read `process` themselves. `okfit` has no analogue; the carve-out is a directory-level decision so the invariant reads "everything else is engine" rather than "these N files are excused".

The drain that made the shared code clean:

- `ConfigDiscovery.find/findAll` and `BiomeSchemaSync.sync/check` take a **required `cwd`**; the `process.cwd()` fallback is gone and the CLI passes its own.
- The changesets logger reads its mode from `Changesets.ChangesetLogMode`, a `Context.Reference` defaulting to `"stderr"` (`"silent" | "github" | "stderr"`). `Changesets.makeChangelogFunctions({ logMode })` provides it; `@savvy-web/changelog` — the host adapter for the changesets CLI — reads `VITEST`/`GITHUB_ACTIONS` from *its* `process.env` and calls the factory. It is provided there rather than in cli/mcp `main.ts` because neither front end runs `getReleaseLine` in its own Effect context (`ReleasePlanner` resolves the changelog *module* by id), so wiring it into the front ends would be dead code that misleads the next reader.

L1 has no carve-out at all: [silk-core/architecture.md](../silk-core/architecture.md) covers its stricter gate.

## The DAG check

`@e2e/workspace` (`e2e/workspace/__test__/e2e/package-graph.e2e.test.ts`) reads every `packages/*/package.json` and `e2e/*/package.json` straight off disk — the live graph, not `layers.json` — extracts every `workspace:*` edge across the three dependency fields, classifies each endpoint against `layers.json`, and asserts the rule list above with offenders rendered as `"<from> -> <to> (<field>)"`. A three-colour DFS proves the whole workspace acyclic. Two positive controls on hand-built fixture graphs (a sideways L3→L3 edge; a three-node cycle) keep the check from passing vacuously; the live-workspace assertion additionally asserts the edge inventory is non-empty.

It is the one `e2e/*` package that does not exercise a built artifact: it has no app-layer devDependencies and spawns nothing. Its single `workspace:*` edge (`@savvy-web/bundler`, so its `tsconfig.json` `extends` resolves) is a harness→tooling edge the rules ignore.

## Hoist removal and release sequencing

`@savvy-web/pnpm-plugin-silk`'s `publicHoistPattern` no longer lists `@savvy-web/cli` or `@savvy-web/mcp`: the bins reach a consumer through silk's own `bin` map. `@savvy-web/changelog` **stays hoisted** — it is resolved BY ID by the changesets engine from the consumer root (a resolution need, not a bin), and the pnpm-plugin-silk comment says so. The `excludeByRepo["savvy-web-systems"]` entry shrank to changelog alone; this repo's own exported `pnpm-workspace.yaml` was already byte-identical because the exclusion had always dropped cli/mcp here, so the removal changes behaviour only for the other consumer repos.

That makes the release order load-bearing: **a silk that carries the bins must be published before or with the pnpm-plugin-silk that stops hoisting.** A consumer that picks up the new config dependency while still on a bin-less silk loses `savvy` from PATH. pnpm-plugin-silk versions independently, so this is a sequencing rule at release time, not something changesets enforces.

## The root depends on silk only

The repo root's `@savvy-web/*` devDependencies are `@savvy-web/silk` and `@savvy-web/changelog`; `@savvy-web/cli` and `@savvy-web/mcp` were dropped. Three providers of the same two bins at the root was exactly the ambiguity the carrier pattern removes; the `savvy` bin now resolves through silk's `dist/dev/pkg` `bin` map. `@e2e/pnpm-plugin-silk`, which resolves `@savvy-web/cli` by package name, declares its own explicit cli devDependency (the harness band may depend on anything). Root scripts, `lib/`, the silk plugin's hooks and the husky hooks were verified to reach the bins by name only; `.changeset/config.json`'s changelog id is the reason changelog stays. [install-orchestration.md](./install-orchestration.md#workspace-linking-settings) carries the same fact from the install side.

## Known gaps

- **`github-info`'s environment read lives inside `@changesets/get-github-info`.** `silk-effects/src/changesets/vendor/github-info.ts` is clean at the file level (the scanner proves it), but the dependency it wraps exposes no token option: it reads `GITHUB_TOKEN`, `GITHUB_SERVER_URL` and `GITHUB_GRAPHQL_URL` from `process.env` internally and falls back to a `.env` file at `process.cwd()`. So engine behaviour still varies by host cwd through that dependency. It is documented as a gap, explicitly not an allowlist entry; the follow-up is to port the lookup onto `@effected/github-api` with the token supplied through a `Context.Reference` the changelog adapter provides.
- **npm bin ownership is ambiguous by design** (see [the carrier decision](#the-carrier-decision)). If silk's shim must be the linked file under npm too, the front ends would have to stop declaring `bin` — a product decision not taken.

## Rationale

### Why a carrier instead of a hoist

A public hoist is a pnpm-only mechanism configured by a config dependency; a consumer on npm, yarn or bun, or one that has not adopted pnpm-plugin-silk, never got the bins. A `bin` entry on the package the consumer already installs works under every manager with nothing to configure, and the mirror bins on the front ends keep `npx @savvy-web/mcp` and the like working for anyone who installs a front end directly.

### Why four named layers and a test

The non-import invariant was grep-guarded and written in prose. Naming the layers in a JSON file and reading the live manifests turns "cli must not import silk" into a structural rule with an offender list, extends it to the new L1/L2 split, and catches the classes of edge — a tooling package growing an app dependency, a sideways L3 edge added for convenience — that a source grep would never see.

### Why silk-core is a peer consumer of the kit, not a dependency holder

Answered in [silk-core/architecture.md](../silk-core/architecture.md#rationale).

## Related documentation

- [install-orchestration.md](./install-orchestration.md) — the `prepare`/`link:` wiring every layer edge relies on.
- [silk/architecture.md](../silk/architecture.md) — the carrier's build posture and export map.
- [silk/plugin.md](../silk/plugin.md) — the plugin loader that execs the project's own `savvy-mcp` bin.
- [cli/architecture.md](../cli/architecture.md), [mcp/architecture.md](../mcp/architecture.md) — the two front ends and their `./main`.
- [mcp/decision-effect-native.md](../mcp/decision-effect-native.md) — the companion decision (#632).
- [silk-effects/architecture.md](../silk-effects/architecture.md) — the engine; [kit-peer-dependencies.md](../silk-effects/kit-peer-dependencies.md) for the load-bearing peers.
- [silk-core/architecture.md](../silk-core/architecture.md) — L1.
- [changelog/architecture.md](../changelog/architecture.md) — the leaf identity and the `ChangesetLogMode` host.
- [pnpm-plugin-silk/architecture.md](../pnpm-plugin-silk/architecture.md) — the hoist list.
- [e2e/architecture.md](../e2e/architecture.md) — `@e2e/workspace` and `@e2e/silk`.
