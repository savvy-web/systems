---
module: silk-effects
category: architecture
status: current
completeness: 95
created: 2026-03-06
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./workspace-analysis.md
  - ./hook-sections.md
  - ./changesets.md
  - ./commitlint.md
  - ./lint.md
  - ./issue-references.md
  - ./turbo.md
  - ./repos.md
  - ./pr-body.md
  - ./kit-peer-dependencies.md
  - ../silk/architecture.md
  - ../silk/plugin.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
  - ../testing/effect-vitest.md
---

# @savvy-web/silk-effects architecture

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Subsystem docs](#subsystem-docs)
- [Export surface](#export-surface)
- [What the kit owns](#what-the-kit-owns)
- [Source layout](#source-layout)
- [Service patterns](#service-patterns)
- [Dependencies and platform requirements](#dependencies-and-platform-requirements)
- [Consumer guide](#consumer-guide)
- [Testing strategy](#testing-strategy)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`@savvy-web/silk-effects` (`packages/silk-effects`) is the platform-agnostic Effect library that holds the Silk Suite's *policy*: publishability rules, workspace analysis, changeset configuration, the shared husky-hook shells and the business logic of the dev-tooling namespaces. It is the one library that all three thin consumers import — `@savvy-web/cli` (command host), `@savvy-web/silk` (config-integration shims) and `@savvy-web/mcp` (the `savvy-mcp` server) — and the non-import invariant (none of those three imports another) is what forces every piece of shared logic to live here. See `../cli/architecture.md`, `../silk/architecture.md` and `../mcp/architecture.md`.

The seam is policy versus mechanism. Generic mechanisms — versioning and tag classification, CLI tool discovery, the managed-section engine, the GitHub issue-reference grammar — live in the `@effected/*` kit; silk-effects layers Silk opinion over them and re-exports nothing from the kit. See [What the kit owns](#what-the-kit-owns).

## Current state

Published and consumed by `cli`, `silk` and `mcp`; the version is in `packages/silk-effects/package.json`. Built by `@savvy-web/bundler` (`savvy.build.ts`) as **ESM only** — `dist/*/pkg/package.json` exposes `import` and `default` conditions and no `require`. The CommonJS loaders that reach silk's shims (notably markdownlint-cli2's custom-rule loader) are satisfied by silk's two CJS override entries, which inline silk-effects rather than `require()` it — see `../silk/architecture.md`.

## Subsystem docs

Each subsystem has its own doc; this file keeps the cross-cutting conventions.

- [Publishability and workspace analysis](./workspace-analysis.md) — `SilkPublishability`, `ChangesetConfigReader`/`ChangesetConfig`, tag formats and the composite `SilkWorkspaceAnalyzer`.
- [Shared hook sections](./hook-sections.md) — the `SavvySections` shell content rendered by the kit's `ManagedSection`, and the uppercase-key guard.
- [Changesets namespace](./changesets.md) — `ConfigInspector`, `ReleasePlanner`, `DepsRegen`, `VersionFiles`, the changelog renderer and the two lint engines.
- [Commitlint namespace](./commitlint.md) — the config factory, the hook rule menu and the coupling to the plugin's commit format.
- [Lint namespace](./lint.md) — the lint-staged handlers, their two entry points and the `Lint.Yaml`/`PnpmWorkspace` formatting invariants.
- [Issue references](./issue-references.md) — the kit-owned grammar behind the three reference call sites (PrBody, commitlint, changesets).
- [Turbo inspection](./turbo.md) — `TurboInspector`/`TurboDigest`, the `--dry=json` safety invariant and the kit `ToolDiscovery` wiring.
- [Vendored repos](./repos.md) — the `.repos/` manifest, submodule lifecycle, drift reconciliation and the OS-permission boundary.
- [PR body contract](./pr-body.md) — the frozen `silk-release` marker grammar shared with `silk-release-action`.
- [Kit peer dependencies](./kit-peer-dependencies.md) — why three `@effected/*` packages are required peers and the `configDependencies` bump trap.

Two small standalone services have no doc of their own: `ConfigDiscovery` (`src/services/ConfigDiscovery.ts`) finds a config file by the Silk convention, `{cwd}/lib/configs/{name}` before `{cwd}/{name}`; `BiomeSchemaSync` (`src/services/BiomeSchemaSync.ts`) checks or rewrites the `$schema` URL of `biome.json`/`biome.jsonc` against a target version, touching only URLs whose host is `biomejs.dev`. Both require `FileSystem`.

## Export surface

All public API ships from the package root (`"."`); there are no sub-path exports. `src/index.ts` is the authoritative listing: the six namespaces (`Changesets`, `Commitlint`, `Lint`, `PrBody`, `Repos`, `Turbo`) via `export * as`, plus the flat-exported errors, schemas and services.

Two rules govern the entry:

- **A flat-exported type carries its full type closure flat.** `CommitlintUserConfig` is flat-exported so a generated `commitlint.config.ts` can name it for declaration emit; the types its fields reach are flat-exported too, because the bundler's API Extractor pass fails on forgotten exports (see `../tsdown-plugins/architecture.md`).
- **Nothing is re-exported from `@effected/*`.** A convenience re-export would give one type two import paths and one more version to keep in step. Consumers import `ManagedSection`, `VersioningStrategy`, `ToolDiscovery` and friends from their kit packages directly, and declare those packages themselves — which is why `packages/silk` carries a direct `@effected/templates` dependency (`../silk/architecture.md`).

## What the kit owns

The table maps each mechanism that once lived here to its kit home. Read it before hunting for a service or pattern constant a consumer repo still mentions.

| Formerly in silk-effects | Kit home | Shape worth knowing |
| --- | --- | --- |
| `VersioningStrategy` service and its result/error types | `@effected/workspaces` `VersioningStrategy` | A value class. `classify({ packages, fixedGroups })` is pure and total, `detect` enumerates the workspace itself, `tagsFor` is an instance method. |
| `TagStrategy` service and `TagFormatError` | `@effected/workspaces` `TagStyle`, `ReleaseTag`, `TrackingTag`, `classifyTag` | Values; the tag style follows from the classification (`versioning.tagStyle`). |
| `ToolDiscovery` service, tool schemas and errors | `@effected/commands` `ToolDiscovery`, `Tool.named`, the `Run` free functions | `ResolvedTool.command(...)` returns a core `ChildProcess.Command`; run it through `Run.text`/`Run.lines`/`Run.exitCode`. Resolution failure is a union whose members carry no `reason` — map from `e.message`. |
| `ManagedSection` service and section schemas/errors | `@effected/templates` `ManagedSection`, `Section`, `SectionId`, `CommentStyle` | Data-first: `CheckOutcome` is a flat `UpToDate`/`Drifted`/`Absent`, `syncMany` became `syncAll`, `read` returns an `Option`. |
| Three hand-rolled issue-reference regexes | `@effected/github-references` | See [Issue references](./issue-references.md). |

Because `classify` and `classifyTag` are total, the errors that used to accompany them are gone and the analyzer's error channel narrowed with them.

## Source layout

The package is organized by role, then by namespace:

```text
src/
  index.ts        ← single root export
  errors/         ← Data.TaggedError classes (one per file)
  schemas/        ← Schema.Class / Schema.TaggedClass value objects and the SavvySections content
  services/       ← Context.Service services with `layer` statics
  utils/          ← small shared helpers
  changesets/  commitlint/  lint/  pr-body/  repos/  turbo/   ← one subtree per namespace, each with its own index.ts
__test__/         ← mirrors src/; integration tests and their fixture tree under integration/
```

## Service patterns

Every service is a `Context.Service` class with a companion exported `*Shape` interface, so consumers and test doubles can name the shape:

```typescript
export interface ServiceNameShape {
  readonly method: (arg: string) => Effect.Effect<Result, ErrorType>;
}

export class ServiceName extends Context.Service<ServiceName, ServiceNameShape>()(
  "@savvy-web/silk-effects/ServiceName",
) {
  static readonly layer: Layer.Layer<ServiceName, never, FileSystem.FileSystem> = Layer.effect(
    this,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return { ... };
    }),
  );
}
```

Two details of the `layer` static are load-bearing. It carries an explicit `Layer.Layer<Service, Error, Requirements>` annotation, so an accidentally added requirement is a type error rather than a silently wider consumer graph — and it is the authoritative statement of what each service needs. And it passes `this`, never the class's own name, as the constructor's first argument: `Layer.succeed`/`Layer.effect` evaluate that argument in the static initializer, where the class name is still in its temporal dead zone and throws at import time.

Errors are `Data.TaggedError` classes with a `message` getter; serialisable value objects are `Schema.Class`/`Schema.TaggedClass`, overriding `[Equal.symbol]`/`[Hash.symbol]` when comparison must ignore a field (`AnalyzedWorkspace` keeps its cyclic `linked`/`fixed` cross-references out of the hash); non-serialisable values with function-valued fields are plain classes with a private constructor and a static `make()`. Discriminated unions that never round-trip through Schema use `Data.taggedEnum` and are matched with `$is`. Result shapes that cross into `@savvy-web/mcp` are `Schema.Struct`s with the TypeScript interface derived from the schema, so the MCP bridge embeds the same source of truth (`../mcp/architecture.md`).

## Dependencies and platform requirements

`effect` is the sole framework peer (v4 folded the platform surface into core). Three kit packages — `@effected/commands`, `@effected/git`, `@effected/workspaces` — are required peers because their service identities cross this package's API boundary; the rest of the kit (including `@effected/markdown`, which owns the canonical markdown stringifier the changelog pipeline emits through) are regular dependencies. See [Kit peer dependencies](./kit-peer-dependencies.md) for the reasoning, and `package.json` for the authoritative ranges — they are `catalog:effected`/`catalog:effected:peers` specifiers, never literals.

The `Changesets` namespace also runs the genuine changesets **v3** engine at runtime (`@changesets/get-release-plan`, `@changesets/apply-release-plan`, `@changesets/config`, `@manypkg/get-packages`), plus `@changesets/changelog-git` behind `vanillaChangelogFunctions` and a small adapter over `@changesets/get-github-info` in `src/changesets/vendor/`.

Consumers provide the platform layer (`NodeServices.layer`, `BunContext.layer`, …). Read each service's `layer` annotation for its requirements; the recurring shapes are `FileSystem` for the config and publishability services, `FileSystem | Path` for the repos services and a **spawn-capable** platform (`ChildProcessSpawner`) wherever git or a binary is run — `Changesets.DepsRegenDefault`, `Turbo.TurboInspector`, `Repos.ReposManager`. Kit services these need alongside (`WorkspaceDiscovery`, `PackageManagerDetector`, `WorkspaceRoot`, `ToolDiscovery`, `ManagedSection`, `Git`) come from the kit packages directly.

## Consumer guide

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform-node
```

A consumer that touches managed sections, tool discovery or workspace snapshots declares those kit packages itself. The pure entry points need no platform layer at all — `SilkPublishability.detect` over a raw `package.json` plus the bundler's `dist/prod/targets.json` binding is the canonical example:

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect(
  "@my-org/pkg",
  { private: true, publishConfig: { access: "public", targets: { npm: true, github: true } } },
  null, // pre-build: one placeholder target per declared key
);
```

Services compose the ordinary way — `Effect.provide(Service.layer)` then the platform layer. The per-host wiring (which layers are shared, which are built per invocation) is documented where the hosts are: `../cli/architecture.md` and `../mcp/architecture.md`.

## Testing strategy

Tests live in `__test__/`, mirroring `src/`. Integration tests under `__test__/integration/` run the real services (`SilkWorkspaceAnalyzer`, `SilkPublishability`, `TurboInspector`) against a fixture tree (`__test__/integration/fixtures/`) organized by runtime, package manager and Silk-vs-default configuration; the fixtures double as living documentation of the supported workspace layouts. Pure schemas and utils have unit and `fast-check` property tests; services have contract tests over test layers.

Suite-wide conventions are in [../testing/effect-vitest.md](../testing/effect-vitest.md): Effect-running tests use `@effect/vitest` with per-test `Effect.provide` and `Effect.flip`; tests that need a `FileSystem` build an `@effected/memfs` volume (`layerFaulty` for injected failures) rather than a hand-rolled stub. The package-specific carve-out is that **memfs records mode bits but never enforces them**, so the `ReposLockdown` tests that assert the OS refusing an operation and the `it.live` lock tests in `__test__/repos/services__config-store.test.ts` that rely on real `open(flag: "wx")` atomicity and mtime staleness, stay on real temp directories. Do not "finish the migration" by moving them.

Some helpers carry a bare `export` from their own module so a test can import them by source path, but are deliberately absent from the namespace `index.ts` (the `ReleasePlanner` helpers in [Changesets](./changesets.md#test-only-exports) are the worked example). That asymmetry is the convention: adding them to the index would turn an implementation detail into a surface consumers pin against.

## Rationale

### Why platform-agnostic

The library is consumed by GitHub Actions, CLI tools and potentially Bun-based tools. Depending on effect's in-core platform abstractions (`FileSystem`, `ChildProcessSpawner`) rather than Node APIs keeps one implementation working across all of them.

### Why the mechanisms went to the kit

`VersioningStrategy`, tag formatting, `ToolDiscovery` and `ManagedSection` carried no Silk opinion; every kit consumer wants them. Keeping them here forced the action repos, which do not depend on silk-effects, to either re-implement them or take a dependency on Silk policy to get generic behavior. The residue in this package is exactly the part that is *about Silk*.

### Why `effect` is the only framework peer

Consumers already depend on it; bundling it would cause version conflicts and duplicate runtimes. The three kit peers exist for the same reason at the kit layer — see [Kit peer dependencies](./kit-peer-dependencies.md).

### Why the tool namespaces live here

In each of the source dev-tooling packages the CLI commands and the config-export modules share the tool's internal logic (the changeset `transform` command and the `./remark` export run the same plugins; the `lint` command and the `./markdownlint` export run the same rules). `cli` must not import `silk`, so the shared logic has one viable home: the library both import.

### Why role-based folders and a single root export

One entry point keeps the build simple and the consumer experience flat — everything imports from the package root, and nobody has to know which sub-path a service lives under.

## Related documentation

- [Publishability and workspace analysis](./workspace-analysis.md)
- [Shared hook sections](./hook-sections.md)
- [Changesets namespace](./changesets.md)
- [Commitlint namespace](./commitlint.md)
- [Lint namespace](./lint.md)
- [Issue references](./issue-references.md)
- [Turbo inspection](./turbo.md)
- [Vendored repos](./repos.md)
- [PR body contract](./pr-body.md)
- [Kit peer dependencies](./kit-peer-dependencies.md)
- [`../cli/architecture.md`](../cli/architecture.md), [`../silk/architecture.md`](../silk/architecture.md), [`../mcp/architecture.md`](../mcp/architecture.md) — the three consumers
- [`../testing/effect-vitest.md`](../testing/effect-vitest.md) — suite-wide test conventions
