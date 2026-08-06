# @savvy-web/silk-effects

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fsilk-effects?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/silk-effects)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

Shared [Effect](https://effect.website/) library providing Silk Suite conventions for publishability detection, changeset config access, release planning, config discovery, Biome schema synchronization and read-only Turborepo inspection. Platform-agnostic — consumers provide their own platform layer (`NodeServices.layer` from `@effect/platform-node`, or the equivalent for their runtime).

## Features

- Detect a package's publish targets from its `package.json` `publishConfig`, with multi-registry support and a changeset-ignore-aware override for `@effected/workspaces`'s `PublishabilityDetector`
- Read changeset config through a typed accessor service that reports silk vs vanilla mode, ignore patterns and fixed groups
- Plan, preview and apply a release over the genuine changesets engine, lint changeset files against the section-aware Silk rules and regenerate pure dependency changesets from a branch diff
- Supply the Silk commitlint config, its prompt and formatter, and the `silk/body-no-markdown` rule
- Run the lint-staged handlers and the `savvy lint fmt` formatters from a single implementation so the hook and the CLI cannot drift
- Inspect a Turborepo read-only — diagnose per-package cache hits, derive the task graph and compute affected packages, all over `turbo --dry`
- Manage the vendored reference repos declared in `.repos/config.json` — submodule status, drift detection, sync, add, pin, note, remove, rename and restore — and keep every vendored tree read-only between mutations
- Locate config files and keep Biome schema URLs in sync across workspaces

## Install

```bash
npm install @savvy-web/silk-effects effect @effect/platform-node
# or
pnpm add @savvy-web/silk-effects effect @effect/platform-node
```

`effect` is a peer dependency. Install the platform package matching your runtime — `@effect/platform-node` for Node.js — to satisfy the `FileSystem` and process services the file-reading services need.

## Quick start

All exports come from the package root:

```typescript
import {
  SilkPublishability,
  ChangesetConfig,
  Changesets, Lint, Turbo,
} from "@savvy-web/silk-effects";
```

`SilkPublishability.detect` is a pure static — no layers, no Effect runtime. Pass a package name, the raw `package.json` and the bundler's resolved target binding (or `null` before the prod build has run) and get back the publish targets the silk rules resolve:

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect(
  "@my-org/my-package",
  {
    private: true,
    publishConfig: { access: "public", targets: { npm: true, github: true } },
  },
  null, // pre-build: one count-accurate placeholder per declared target key
);
// => [PublishTarget { name: "@my-org/my-package", registry: "https://registry.npmjs.org", ... },
//     PublishTarget { name: "@my-org/my-package", registry: "https://npm.pkg.github.com", ... }]
```

## Services

The services are grouped by which platform layers they require.

---

### No platform layer required

These services are pure logic — no filesystem or shell access needed.

#### SilkPublishability

Apply silk publishability rules to a raw `package.json` and the bundler's resolved target binding, and resolve the publish targets. Targets are `PublishTarget` records from `@effected/workspaces` with `name`, `registry`, `directory`, `access` and `provenance` fields. The static `detect` helper is pure; `resolveTargets` and `listPublishable` are Effects that read from disk (see below), and `readTargetsBinding` reads the binding `detect` consumes.

In silk mode `private: true` is the norm on workspace `package.json` files. Publishability is derived from `publishConfig`, with the `private` flag consulted only as a last-resort default. Publish targets are declared as the bundler's keyed `publishConfig.targets` map; the legacy array form is no longer supported.

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

// Targets-first: one PublishTarget per declared publishConfig.targets key
const targets = SilkPublishability.detect(
  "@my-org/pkg",
  {
    private: true,
    publishConfig: { access: "public", targets: { npm: true, github: true } },
  },
  null, // pre-build placeholder; pass the dist/prod/targets.json binding post-build
);
// => [PublishTarget { registry: "https://registry.npmjs.org", access: "public", ... },
//     PublishTarget { registry: "https://npm.pkg.github.com", access: "public", ... }]

// Not publishable -> empty array
const none = SilkPublishability.detect("@my-org/internal", { private: true }, null);
// => []
```

See [Publishability](./docs/03-publishability.md) for the full rule order and the disk-reading helpers.

#### Tags and versioning classification

Git-tag naming and versioning classification live upstream in `@effected/workspaces` as pure value classes — `ReleaseTag`, `TrackingTag`, `classifyTag` and `VersioningStrategy` — so there is no service, no layer and no error channel.

```typescript
import { VersioningStrategy } from "@effected/workspaces";

const strategy = VersioningStrategy.classify({ packages: publishablePackages, fixedGroups });
const tags = strategy.tagsFor([{ name: "@savvy-web/silk-effects", version: "1.0.0" }]);
// => [ReleaseTag { value: "@savvy-web/silk-effects@1.0.0" }]
```

`WorkspaceAnalysis.versioning` and `WorkspaceAnalysis.tagStrategy` carry those kit types directly.

#### ChangesetLinter

Validate a changeset file against the Silk section rules. `ChangesetLinter.validateContent(content, filePath?)` and `ChangesetLinter.validateFile(filePath)` are static and synchronous, returning `LintMessage[]` — no Effect, no layers. Rules cover the valid section headings, structural constraints, and the dependency-table format, so a `## Dependencies` section written as prose or a bullet list is reported rather than accepted.

```typescript
import { Changesets } from "@savvy-web/silk-effects";

const messages = Changesets.ChangesetLinter.validateFile(".changeset/quiet-moons-render.md");
// => [] when the file is valid, otherwise one LintMessage per violation
```

---

### FileSystem layer required

These services read or write files. Provide the platform layer for your runtime, such as `NodeServices.layer`.

#### SilkPublishability.layer and SilkPublishability.layerAdaptive

`SilkPublishability.detect` is also exposed through `@effected/workspaces`'s `PublishabilityDetector` Tag so consumers can swap silk rules into any program that already yields the detector. Two static layers override the Tag:

- `SilkPublishability.layer` — applies silk rules unconditionally. Requires `FileSystem`.
- `SilkPublishability.layerAdaptive` — ignore-aware. Changeset-`ignore`d packages resolve to `[]`, then it dispatches by changeset mode (`none` → `[]`, `silk` → silk rules, `vanilla` → the `@effected/workspaces` default). Requires `FileSystem` and `ChangesetConfig`.

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { PublishabilityDetector } from "@effected/workspaces";
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const detector = yield* PublishabilityDetector;
    return yield* detector.detect(pkg, root);
  }).pipe(
    Effect.provide(SilkPublishability.layer),
    Effect.provide(NodeServices.layer),
  ),
);
// => ReadonlyArray<PublishTarget>
```

See [Publishability](./docs/03-publishability.md) for the adaptive layer and the `ChangesetConfig` service.

#### ChangesetConfig

Typed accessor over a workspace root's `.changeset/config.json`, reading through `ChangesetConfigReader` with a per-root cache. Every accessor is total — a missing or unreadable config collapses to `mode: "none"` and empty defaults. Methods: `mode`, `versionPrivate`, `ignorePatterns`, `isIgnored`, `fixed` and `refresh` (drops every cached read so a long-lived host observes on-disk config edits made since the last call), plus a static `ChangesetConfig.matches(name, pattern)`.

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import {
  ChangesetConfig, ChangesetConfigReader,
} from "@savvy-web/silk-effects";

const mode = await Effect.runPromise(
  Effect.gen(function* () {
    const config = yield* ChangesetConfig;
    return yield* config.mode(process.cwd());
  }).pipe(
    Effect.provide(ChangesetConfig.layer),
    Effect.provide(ChangesetConfigReader.layer),
    Effect.provide(NodeServices.layer),
  ),
);
// => "silk" | "vanilla" | "none"
```

#### Husky hook sections

The Silk husky hooks are data. `SavvySections` supplies the section identities and the shell that goes inside them, and [`@effected/templates`](https://www.npmjs.com/package/@effected/templates)' `ManagedSection` service does the reading and writing, so user content outside the `# --- BEGIN ... ---` markers is never touched.

- `SavvyBaseSection` is the shared preamble's identity (key `SAVVY-BASE`); pair it with `savvyBasePreamble()`, which defines `ROOT`, the `in_ci` predicate, `PM` via package-manager detection and `pm_exec`.
- `SavvyHooksSection` (key `SAVVY-HOOKS`) pairs with `savvyHooksHygiene()`, a self-guarded repo-hygiene block that runs outside CI.
- `savvyToolSection(toolName, command)` builds a consumer's one-line tool section whose content is exactly `in_ci || pm_exec <command>` — the command is appended verbatim, so shell tokens like `$ROOT` and `$1` survive into the output. A `savvy-base` section must come first in the same hook file, so pass both to `syncAll` in that order.

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ManagedSection } from "@effected/templates";
import { SavvyBaseSection, savvyBasePreamble, savvyToolSection } from "@savvy-web/silk-effects";

await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    const results = yield* ms.syncAll(".husky/commit-msg", [
      SavvyBaseSection.section(savvyBasePreamble()),
      savvyToolSection("savvy-commit", 'commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"'),
    ]);
    // => one sync result per input section, in declared order
  }).pipe(
    Effect.provide(ManagedSection.layer),
    Effect.provide(NodeServices.layer),
  ),
);
```

#### ChangesetConfigReader

Read and decode `.changeset/config.json`. Auto-detects whether the project uses `@savvy-web/changesets` (returning `SilkChangesetConfigFile` with `_isSilk: true`) or standard changesets (returning `ChangesetConfigFile`).

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import {
  ChangesetConfigReader,
} from "@savvy-web/silk-effects";

const config = await Effect.runPromise(
  Effect.gen(function* () {
    const reader = yield* ChangesetConfigReader;
    return yield* reader.read(process.cwd());
  }).pipe(
    Effect.provide(ChangesetConfigReader.layer),
    Effect.provide(NodeServices.layer),
  ),
);
// => ChangesetConfigFile | SilkChangesetConfigFile
```

#### ConfigDiscovery

Locate config files using a priority-based search convention. Checks `lib/configs/{name}` (shared configs) first, then `{cwd}/{name}` (local override).

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ConfigDiscovery } from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const cd = yield* ConfigDiscovery;
    return yield* cd.find("biome.jsonc");
  }).pipe(
    Effect.provide(ConfigDiscovery.layer),
    Effect.provide(NodeServices.layer),
  ),
);
// => { path: "/project/biome.jsonc", source: "root" } | null
```

#### BiomeSchemaSync

Keep Biome config `$schema` URLs current. Locates `biome.json` or `biome.jsonc`, compares the `$schema` value against the expected URL for the given version, and optionally updates in place. Strips semver range prefixes.

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { BiomeSchemaSync } from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const bss = yield* BiomeSchemaSync;
    return yield* bss.sync("2.0.0");
  }).pipe(
    Effect.provide(BiomeSchemaSync.layer),
    Effect.provide(NodeServices.layer),
  ),
);
// => { updated: true, skipped: false, current: "2.0.0" }
```

#### ConfigInspector

Resolve `.changeset/config.json` into a fully attributed view of the workspace: the configured changelog, base branch, access and ignore list, plus one scope per package carrying its `workspaceDir`, version, `additionalScopes` and resolved `versionFiles`. `inspect(cwd)` returns that view and `classify` maps arbitrary file paths to the package that owns them, which is how a branch diff becomes a per-package attribution. `refresh()` clears the per-root cache, which a long-lived host needs in order to see config edits made between calls.

`Changesets.ConfigInspector.layer` requires `ChangesetConfigReader`, `WorkspaceDiscovery` from [`@effected/workspaces`](https://www.npmjs.com/package/@effected/workspaces) and `FileSystem`.

#### ReleasePlanner

Drive the genuine changesets engine rather than shelling out to the `changeset` binary. Three members:

- `plan(root)` computes the in-memory release plan. It renders nothing, so it resolves no changelog module.
- `preview(root, options?)` renders a non-destructive preview, running the real engine against a scope-managed temp directory and reading the generated CHANGELOG blocks back. The repository is never mutated.
- `apply(root, options?)` performs the release — version bumps, CHANGELOG writes and configured version-file updates. Pass `dryRun` to compute without writing.

Both `preview` and `apply` accept `changelogModules`, mapping the changelog id configured in `.changeset/config.json` to an absolute module path. Reach for it when running somewhere the configured id cannot be resolved — a bundled GitHub Action with no `node_modules`, for instance. When set, the configured id must be a key of the map, an unmapped id fails with a `ReleasePlanError` naming the supported keys, and the engine's formatter integration is disabled so the caller owns formatting.

```typescript
const preview = yield* planner.preview(root, {
  changelogModules: { "@savvy-web/changelog": changelogModulePath },
});
// => ChangesetPreview: per-release changelogEntry, versions and changeset ids
```

`Changesets.ReleasePlanner.layer` requires `ConfigInspector` and `FileSystem`.

---

### FileSystem + process layer required

#### BranchAnalyzer

`analyzeBranch` classifies a branch's diff by the package that owns each file, applying `ConfigInspector` attribution over the git range. This is what answers "what changed on this branch, and which package releases because of it", including the unmapped files that belong to no package.

`Changesets.BranchAnalyzer.layer` requires `ConfigInspector` and the platform process spawner.

#### DepsRegen

Own dependency-changeset orchestration, split so that detection and regeneration share one code path: `plan(options)` computes a complete, side-effect-free `RegenPlan` — target filenames, each row's from/to version, and any stale pure-dependency changesets marked for deletion — and `execute(plan)` applies exactly what the plan describes. A dry run is `plan()` plus rendering.

Both sides of the diff are snapshotted at their own git ref, so `catalog:` and `workspace:` specifiers resolve per side before the comparison. A specifier that changes protocol without changing its resolved version produces no row.

`Changesets.DepsRegenDefault` is the batteries-included layer, composing the full graph with silk's opinionated defaults and leaving only the platform services open. Because snapshots read git history, provide a spawn-capable layer such as `NodeServices.layer` rather than a filesystem-only one.

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { Changesets } from "@savvy-web/silk-effects";

const plan = await Effect.runPromise(
  Effect.gen(function* () {
    const regen = yield* Changesets.DepsRegen;
    return yield* regen.plan({});
  }).pipe(
    Effect.provide(Changesets.DepsRegenDefault),
    Effect.provide(NodeServices.layer),
  ),
);
// => RegenPlan: files to write, rows per package, changesets to delete
```

`Changesets.DepsRegen.layer` is the seam for callers injecting their own dependencies; it requires `WorkspaceSnapshots`, `ConfigInspector`, `WorkspaceDiscovery`, `PublishabilityDetector`, `ChangesetConfig`, `Git` and `FileSystem`.

#### TurboInspector

Read-only Turborepo inspection. Every method shells out to `turbo` with `--dry=json`, so no task ever runs. `diagnoseCache(task, cwd)` reports a per-package cache HIT/MISS breakdown for a task, `taskGraph(cwd, task?)` derives the task graph and its critical path and `affected(cwd, base?)` lists the packages affected relative to `base` (default `main`). It resolves the `turbo` binary through `ToolDiscovery` from [`@effected/commands`](https://www.npmjs.com/package/@effected/commands) and fails with a tagged error when `turbo` is missing or the directory is not a Turborepo. The service tag and its layer are exported under the `Turbo` namespace.

`Turbo.TurboInspector.layer` requires `ToolDiscovery`, `Git` from [`@effected/git`](https://www.npmjs.com/package/@effected/git), `FileSystem` and the platform process spawner. Wire `ToolDiscovery` to the workspace with `Workspaces.localExecLayer()`, which teaches it the argv prefix that runs a project-local binary:

```typescript
import { Effect, Layer } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ToolDiscovery } from "@effected/commands";
import { Git } from "@effected/git";
import { PackageManagerDetector, WorkspaceRoot, Workspaces } from "@effected/workspaces";
import { Turbo } from "@savvy-web/silk-effects";

const WorkspaceLive = Layer.mergeAll(WorkspaceRoot.layer, PackageManagerDetector.layer);
const ToolsLive = ToolDiscovery.layer.pipe(
  Layer.provide(Workspaces.localExecLayer()),
  Layer.provide(WorkspaceLive),
);

const diagnosis = await Effect.runPromise(
  Effect.gen(function* () {
    const turbo = yield* Turbo.TurboInspector;
    return yield* turbo.diagnoseCache("build:dev", process.cwd());
  }).pipe(
    Effect.provide(Turbo.TurboInspector.layer),
    Effect.provide(Layer.mergeAll(ToolsLive, Git.layer)),
    Effect.provide(NodeServices.layer),
  ),
);
// => CacheDiagnosis: per-package HIT/MISS breakdown for the task
```

#### ReposManager, ReposDrift and ReposLockdown

The `Repos` namespace drives vendored reference repos — upstream sources checked out as git submodules under `.repos/`, declared in a `.repos/config.json` manifest. `ReposConfigStore` reads and writes that manifest, and `ReposManager` does the git work: `status(root)` reports presence, the pinned commit, working-tree dirtiness and stale notes, `sync(root)` initializes missing submodules and applies each entry's sparse-checkout, `pin(root, name, ref)` moves an entry to a new ref, `add(root, options)` vendors a new one, `note(root, name, op)` adds, removes or promotes an agent note, `remove(root, name)` unvendors an entry, `rename(root, oldName, newName)` renames one in place, and `restore(root, names?)` hard-resets one or more dirty checkouts back to their pinned commit. `ReposDrift.check(root)` is a read-only companion — it reconciles the manifest, `.gitmodules`, the worktree, and `git submodule status`, reporting any mismatch as a typed drift kind.

`ReposLockdown` is the permissions boundary around all of that. `lock(root, name)` chmods a vendored worktree and its submodule git metadata to files `0444` and directories `0555` (an executable file locks at `0555` instead, preserving its executable bit); `unlock` reverses it, restoring `0644`/`0755` (`0755` for a file that was executable); `withUnlocked(root, name, effect)` brackets an effect between the two. `ReposManager`'s `sync`, `add`, `pin`, `remove` and `restore` run their git mutations inside that bracket and re-lock afterwards, and `rename` hand-rolls the same unlock/relock contract across its `oldName`→`newName` move, so a vendored tree is read-only whenever the manager is not mid-write. Reads are unaffected — a locked tree needs no special handling to open a file.

Two consequences for callers: `ReposManager.layer` requires `ReposLockdown` alongside `ReposConfigStore`, `Git`, `FileSystem` and `Path`, and `sync`, `add`, `pin`, `remove`, `rename` and `restore` widen their error channel with `ReposLockdownError`, which carries the offending `path` and a `reason`.

```typescript
import { Effect, Layer } from "effect";
import { NodeServices } from "@effect/platform-node";
import { Git } from "@effected/git";
import { Repos } from "@savvy-web/silk-effects";

const report = await Effect.runPromise(
  Effect.gen(function* () {
    const repos = yield* Repos.ReposManager;
    return yield* repos.sync(process.cwd());
  }).pipe(
    Effect.provide(Repos.ReposManager.layer),
    Effect.provide(Layer.mergeAll(Repos.ReposConfigStore.layer, Repos.ReposLockdown.layer, Git.layer)),
    Effect.provide(NodeServices.layer),
  ),
);
// => ReposSyncReport: per-repo initialization and sparse-checkout outcome, trees left read-only
```

## Documentation

- [Overview](./docs/01-overview.md) — what the library is, its design philosophy and platform-layer model
- [Platform layers](./docs/02-platform-layers.md) — composing layers and providing platform dependencies
- [Publishability](./docs/03-publishability.md) — silk publishability rules, the detector overrides and the ChangesetConfig service
- [Changeset config](./docs/04-changeset-config.md) — reading and decoding `.changeset/config.json`
- [Config discovery](./docs/05-config-discovery.md) — priority-based config file search
- [Biome sync](./docs/06-biome-sync.md) — keeping Biome `$schema` URLs current

## License

[MIT](LICENSE)
