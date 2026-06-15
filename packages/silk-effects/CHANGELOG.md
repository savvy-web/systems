# @savvy-web/silk-effects

## 1.2.0

### Features

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `Lint.POST_COMMIT_HOOK_PATH` export (#122)

A new constant `Lint.POST_COMMIT_HOOK_PATH` is exported from the `Lint` namespace, resolving to `.husky/post-commit`. It holds the conventional path for the savvy-hooks post-commit hygiene script so callers that create or inspect the hook do not need to hard-code the path themselves.

### `ConfigInspector` augments explicit `packages` records (#127)

`Changesets.ConfigInspector` now **augments** an explicit `.changeset/config.json` `packages` record with the remaining release-surface workspace packages detected via `SilkPublishability`, rather than treating the record as a closed allow-list.

Previously, a `packages` record that existed only to annotate one package's `versionFiles` caused every other workspace package to be classified as unmapped during branch analysis. With this fix, all publishable workspace packages appear in the attribution map; packages whose annotation (`additionalScopes`, `versionFiles`, etc.) comes entirely from the config record retain their annotation, while unannotated packages are added with default attribution.

### Markdownlint template ignores test-fixture directories (#123)

The generated `.markdownlint-cli2.jsonc` template now adds `**/__test__/**/fixtures/**` and `**/__fixtures__/**` to its `ignores` list. This brings the markdownlint handler into parity with the Yaml, Biome, and PackageJson handlers, which already excluded these paths.

The template's `MD025` rule is now configured as `{ "front_matter_title": "" }` (previously `true`), matching the `MD024: { "siblings_only": true }` rule it already carried. A regenerated config now allows sibling duplicate headings and treats front-matter titles as `H1`s consistently.

## 1.1.0

### Features

* [`5242460`](https://github.com/savvy-web/systems/commit/524246022b19465fad0e7a52de021b9804b1c37b) Exposes the changeset resolved-output result types as Effect `Schema`, so downstream tools can validate them and generate schemas from a single source of truth. New exports from the `Changesets` namespace: `BranchAnalysisSchema`, `BranchFileEntrySchema`, `FileStatusSchema`, `InspectedConfigSchema`, `ResolvedPackageScopeSchema`, `ResolvedVersionFileSchema`, `ClassificationSchema`, and `ClassificationReasonSchema`. The existing `BranchAnalysis`, `InspectedConfig`, and related types are now derived from these schemas, so their shape is unchanged.

### Bug Fixes

* [`5242460`](https://github.com/savvy-web/systems/commit/524246022b19465fad0e7a52de021b9804b1c37b) `ConfigInspector` now attributes changed files to workspace packages even when `.changeset/config.json` declares no explicit `packages` record. It falls back to the discovered workspace packages that are a release surface — those whose `publishConfig` resolves to publish targets — so single-root repos and monorepos with a non-root package directory get correct attribution instead of an empty result. A private package with no `publishConfig` is correctly excluded, and packages in the `ignore` list remain valid changeset targets.
* `silk/body-no-markdown` no longer flags double-underscore identifiers such as `__PACKAGE_VERSION__` as bold. Bold is now detected only in its asterisk form, so identifier tokens written in commit bodies are accepted.

### Dependencies

* | [`e6e3ee4`](https://github.com/savvy-web/systems/commit/e6e3ee464b9e5ae56e45acbf03b583e1bc11d7c3) | Dependency | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :------ | :------ | -- |
  | tinyglobby                                                                                        | dependency | updated | ^0.2.16 | ^0.2.17 |    |

## 1.0.1

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | sort-package-json                                                                                 | dependency | updated | ^3.6.1 | ^4.0.0 |    |
  | workspaces-effect                                                                                 | dependency | updated | ^1.1.0 | ^1.2.0 |    |

## 1.0.0

### Breaking Changes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Publish-target resolution is binding-driven and Record-map only

`SilkPublishability` no longer understands the legacy array form of `publishConfig.targets` — declare targets as the keyed Record-map (`{ npm: true, github: true, … }`). Target resolution now matches the `@savvy-web/bundler` prod layout:

* `SilkPublishability.detect(pkgName, raw, binding)` takes a third argument: the parsed `dist/prod/targets.json` binding (or `null` before the prod build). With a binding it emits one `PublishTarget` per resolved registry target, with `directory` set to the bound group's `dist/prod/<group>/pkg` dir. `npm: true` + `github: true` collapse into one scoped-name byte group deployed to both registries (two targets, one directory). Without a binding it emits one count-accurate placeholder per declared key.
* `access` comes from top-level `publishConfig.access` (default `public`); per-target `access`/`provenance`/`directory` and string shorthands are removed (`provenance` defaults `false`).
* New public API: `readTargetsBinding(fs, pkgPath)` and the binding types `TargetsBinding` / `TargetBinding` / `TargetGroupBinding`. Removed `RawTargetSpec`, replaced by `RawTargetObject` / `RawTargetValue` / `RawPublishTargets`.
* Both `PublishabilityDetector` layers and `SilkWorkspaceAnalyzer` thread the binding through.

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Adds the `Turbo` read-only Turborepo inspection namespace (`TurboInspector` + `TurboDigest` exposing `diagnoseCache`/`taskGraph`/`affected`, all `--dry`).

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`.

## 0.6.1

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments

## 0.6.0

### Features

* [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) ### Changesets namespace

Adds a `Changesets` namespace export with the full changeset tooling logic extracted from the standalone `@savvy-web/changesets` package. Consumers can import changeset validation, changelog generation, dependency-table utilities, remark pipeline plugins, markdownlint custom rules, and Effect-based services (`ConfigInspector`, `BranchAnalyzer`, `ChangelogService`) directly from `@savvy-web/silk-effects`.

```typescript
import { Changesets } from "@savvy-web/silk-effects";

// Changelog formatter
const { getReleaseLine, getDependencyReleaseLine } = Changesets.Changelog;

// Linter API
const result = await Changesets.Linter.lint(changesetContent);

// Remark pipeline presets
const output = await Changesets.Remark.transform(markdown);
```

### Bug Fixes

* [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) `SilkWorkspaceAnalyzer.analyze(root)` now passes `root` through to `WorkspaceDiscovery.listPackages()`. Previously the call omitted `root`, causing package discovery to resolve from the process working directory rather than the requested workspace root. Topological sort falls back to discovery order when the sort was built against a different root (e.g. in tests).

### Commitlint namespace

Adds a `Commitlint` namespace export carrying the hook, formatter, config factory, prompt configuration, and detection utilities that back the Silk commitlint integration. Includes the Claude Code hook diagnostics (branch, DCO, open-issues, signing), the custom rules engine, and the silent-logger shim.

```typescript
import { Commitlint } from "@savvy-web/silk-effects";

// Config factory
const config = Commitlint.Config.factory({ scopes: ["feat", "fix"] });

// Formatter
const formatted = Commitlint.Formatter.format(results);
```

### Lint namespace

Adds a `Lint` namespace export with workspace-aware Biome, Markdown, TypeScript, YAML, and shell-script lint handler logic, plus the `createConfig` preset builder and workspace-discovery utilities.

```typescript
import { Lint } from "@savvy-web/silk-effects";

// Create a lint preset config
const config = Lint.Config.createConfig({ preset: "strict" });
```

### Dual-format build

The package now ships both ESM and CJS bundles. The CJS build allows tools with CommonJS loaders — such as `markdownlint-cli2`'s custom-rule loader — to `require()` the markdownlint rules directly from `@savvy-web/silk-effects`.

## 0.5.0

### Features

* [`1321cc8`](https://github.com/savvy-web/systems/commit/1321cc8965d0c24bccf5fc783f0bee7934227b16) ### `ManagedSection.syncMany` — ordered multi-section sync

`ManagedSection.syncMany(path, blocks)` (and its data-last form `syncMany(blocks)(path)`) accepts an ordered array of `SectionBlock` descriptors and ensures every section exists with its given content in declared relative order. Existing sections are updated in place; missing sections are inserted adjacent to their declared sibling. Section order is normalized on each call, user content and unrelated tool sections are preserved, and the operation is idempotent. Returns one `SyncResult` (`Created` / `Updated` / `Unchanged`) per input block, in input order.

```typescript
import { Effect } from "effect";
import {
  ManagedSection,
  SavvyBaseSection,
  savvyBasePreamble,
  savvyToolSection,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const sections = yield* ManagedSection;
  return yield* sections.syncMany(".husky/pre-commit", [
    SavvyBaseSection.block(savvyBasePreamble()),
    savvyToolSection(
      "savvy-lint",
      'lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"',
    ),
  ]);
});
// result: [SyncResult.Created, SyncResult.Created]
```

### `ManagedSection.remove` — section removal

`ManagedSection.remove(path, definition)` (and its data-last form `remove(definition)(path)`) removes a managed section's full marker span from the file and collapses the leftover blank line. Returns `true` when a section was removed, `false` when the section is absent or the file does not exist. Useful for migrating renamed sections.

```typescript
const program = Effect.gen(function* () {
  const sections = yield* ManagedSection;
  return yield* sections.remove(".husky/pre-commit", OldSection);
});
// result: true (a section was removed) | false (absent or file missing)
```

### `SavvySections` — shared husky-hook shell helpers

New helpers, exported from the package root, provide composable primitives for building multi-section husky hooks:

* `SavvyBaseSection` + `savvyBasePreamble()` — a package-manager detection preamble that sets `ROOT`, `in_ci`, `PM`, and `pm_exec` shell variables.
* `SavvyHooksSection` + `savvyHooksHygiene()` — a self-guarded repo hygiene section (runs only outside CI).
* `savvyToolSection(toolName, command)` — builds an `in_ci || pm_exec <command>` tool-execution section for any named tool.

Together these let consumer CLIs compose multiple ordered managed sections per hook file and migrate renamed sections cleanly.

```typescript
import {
  SavvyBaseSection,
  savvyBasePreamble,
  savvyToolSection,
} from "@savvy-web/silk-effects";

// savvyToolSection needs a savvy-base section ahead of it in the same hook so
// `in_ci` / `pm_exec` are defined — pass both to syncMany in order.
const blocks = [
  SavvyBaseSection.block(savvyBasePreamble()),
  savvyToolSection(
    "savvy-lint",
    'lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"',
  ),
];
```

## 0.4.1

### Dependencies

* | [`846ab73`](https://github.com/savvy-web/systems/commit/846ab73ee6d7dba52822cd7d346fa0c2b66156da) | Dependency    | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :------ | :------ | -- |
  | workspaces-effect                                                                                 | dependency    | updated | ^1.0.0  | ^1.1.0  |    |
  | @savvy-web/rslib-builder                                                                          | devDependency | updated | ^0.20.4 | ^0.20.6 |    |

## 0.4.0

### Minor Changes

* [`30f6764`](https://github.com/savvy-web/systems/commit/30f6764ead0350128471d09721c4d5df15addb6c) Standardize publishability on workspaces-effect's `PublishTarget` + `PublishabilityDetector` Tag. Adds `SilkPublishability` (the silk `detect` rule plus `expandShorthand`/`resolveTargetAccess` helpers and `resolveTargets`/`listPublishable` resolvers, all as static members), `SilkPublishabilityDetectorLive`, `PublishabilityDetectorAdaptiveLive` (ignore-aware silk/vanilla/none dispatch over the `PublishabilityDetector` Tag), and a `ChangesetConfig` accessor service (`mode`/`versionPrivate`/`ignorePatterns`/`isIgnored`/`fixed`, plus the static `ChangesetConfig.matches` ignore matcher). `SilkWorkspaceAnalyzer` now emits `PublishTarget` and honors `@scope/*` wildcard changeset-ignore patterns.

**Breaking:** removes the bespoke `SilkPublishabilityPlugin`, `TargetResolver`, the `PublishabilitySchemas` exports (`PublishTarget`/`ResolvedTarget`/`PublishProtocol`/`PublishTargetObject`/`PublishTargetShorthand`/`AuthStrategy`), `TargetResolutionError`, and `PublishConfigError`. The changeset-config schema types `ChangesetConfig`/`SilkChangesetConfig` are renamed to `ChangesetConfigFile`/`SilkChangesetConfigFile` — the `ChangesetConfig` name is now the accessor service. `auth`/`tokenEnv` resolution moves consumer-side.

## 0.3.0

### Features

* [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Added `SilkWorkspaceAnalyzer` service — composite service that analyzes a workspace root and produces a complete `WorkspaceAnalysis` result. Discovers workspaces via `workspaces-effect`, detects publishability with Silk multi-target support, reads changeset config, computes versioning strategy, and determines release status per workspace.
* Added `AnalyzedWorkspace` and `WorkspaceAnalysis` — `Schema.TaggedClass` data types with instance methods for workspace queries, target lookups, group membership, and filtered views. Includes `Equal`/`Hash` support and `Pretty` printing.
* Added `SilkPublishConfig` schema — extends the upstream `PublishConfig` from `workspaces-effect` with a Silk `targets` field for multi-registry publishing.
* Extended `ChangesetConfig` to cover the full `@changesets/config@3.1.1` specification, including `privatePackages`, `snapshot`, `prettier`, `changedFilePatterns`, and `bumpVersionsWithWorkspaceProtocolOnly`.

### Tests

* [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Added 100+ fixture files across standalone, pnpm, npm, yarn, and bun workspace configurations, with 29 integration tests that exercise the full `SilkWorkspaceAnalyzer` pipeline against real filesystem reads.
* `AnalyzedWorkspace` and `WorkspaceAnalysis` include property-based test coverage via `fast-check`.

### Maintenance

* [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Migrated all co-located unit tests from `src/` to `__test__/` for consistent `vitest` auto-discovery.

## 0.2.2

### Bug Fixes

* [`b65d3d2`](https://github.com/savvy-web/systems/commit/b65d3d26fb9da4474b9e39225d8c4b85d35e6eac) ### Fix ManagedSection markers missing newline separators from content

BEGIN/END markers were concatenated directly with managed content, producing malformed output where markers and content appeared on the same line. The service now ensures markers are always on their own lines and handles boundary newlines transparently on read/write round-trips.

## 0.2.1

### Bug Fixes

* [`31824c1`](https://github.com/savvy-web/systems/commit/31824c15a013cf5ce13462c4dfc223785f9e893e) Bumps workspaces-effect dependency for parsing issue fix

## 0.2.0

### Features

* [`0da7c1e`](https://github.com/savvy-web/systems/commit/0da7c1e04fa60ad6745d3dbabf9af9a5b68d780d) ### SectionDefinition and SectionBlock value objects

Introduces `SectionDefinition` and `ShellSectionDefinition` as `Schema.TaggedClass` value objects that declare the identity of a managed section type. `SectionDefinition` compares on `toolName` + `commentStyle` via `Equal`/`Hash`. `ShellSectionDefinition` is a convenience subtype that hardcodes `commentStyle` to `"#"`.

`SectionBlock` is the complementary value object holding the content between a pair of managed section markers. Equality is normalized (trimmed, whitespace-collapsed), so cosmetic whitespace differences do not produce spurious diffs.

Both classes expose a dual API (`Fn.dual`) so methods can be used data-first or data-last in a pipeline:

```typescript
import { SectionDefinition, SectionBlock } from "@savvy-web/silk-effects";

const def = new SectionDefinition({ toolName: "silk", commentStyle: "#" });

// Data-first
const block = def.block("\nexport FOO=bar\n");

// Dual static — data-last for pipe composition
const withValidation = SectionDefinition.withValidation((block) =>
  block.content.includes("FOO"),
)(def);
```

### SectionDiff, SyncResult, and CheckResult tagged enums

Three `Data.TaggedEnum` types capture the outcomes of section operations:

* `SectionDiff` — `Unchanged` or `Changed({ added, removed })` from comparing two `SectionBlock` values
* `SyncResult` — `Created`, `Updated({ diff })`, or `Unchanged` from a write-if-changed operation
* `CheckResult` — `Found({ isUpToDate, diff })` or `NotFound` from a read-only comparison

### ManagedSection service redesigned with sync/check/dual API

`ManagedSection` is a fully redesigned `Context.Tag` service backed by `@effect/platform` `FileSystem`. The previous hook-style API is replaced with five operations, all using the dual pattern:

| Method      | Takes               | Returns                |
| :---------- | :------------------ | :--------------------- |
| `read`      | `SectionDefinition` | `SectionBlock \| null` |
| `isManaged` | `SectionDefinition` | `boolean`              |
| `write`     | `SectionBlock`      | `void`                 |
| `sync`      | `SectionBlock`      | `SyncResult`           |
| `check`     | `SectionBlock`      | `CheckResult`          |

`sync` writes only when content has changed and returns a typed result describing what happened. `check` is read-only and reports staleness without writing.

```typescript
import {
  ManagedSection,
  ManagedSectionLive,
  SectionBlock,
} from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";

const block = SectionBlock.make({
  toolName: "silk",
  commentStyle: "#",
  content: "\nexport FOO=bar\n",
});

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  const result = yield* ms.sync(".env.local", block);
  // result is SyncResult.Created | SyncResult.Updated | SyncResult.Unchanged
});

Effect.runPromise(
  program.pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

### ToolDiscovery service

New `ToolDiscovery` `Context.Tag` service that locates CLI tools globally (PATH) or locally (via the detected package manager), extracts versions, enforces source and version constraints, and caches results by tool name.

Three resolution methods:

* `resolve(definition)` — returns `ResolvedTool` or `ToolResolutionError`
* `require(definition, message?)` — like `resolve` but maps failures to `ToolNotFoundError`
* `isAvailable(definition)` — quick boolean availability check, no caching

Resolution behavior is controlled by three tagged-enum policies on `ToolDefinition`:

* `VersionExtractor` — `Flag({ flag, parse? })`, `Json({ flag, path })`, or `None`
* `ResolutionPolicy` — `Report`, `PreferLocal`, `PreferGlobal`, or `RequireMatch`
* `SourceRequirement` — `Any`, `OnlyLocal`, `OnlyGlobal`, or `Both`

```typescript
import {
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
  ResolutionPolicy,
} from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";

const biome = ToolDefinition.make({
  name: "biome",
  policy: ResolutionPolicy.PreferLocal(),
});

const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;
  const tool = yield* td.require(biome);
  // tool.exec("check", "--write") returns a ToolCommand
  return yield* tool.exec("check", "--write").string();
}).pipe(Effect.provide(ToolDiscoveryLive), Effect.provide(NodeContext.layer));
```

### ResolvedTool and ToolCommand

`ResolvedTool` is the `Schema.TaggedClass` value returned by `ToolDiscovery`. It carries the resolved source, versions, and package manager, and exposes two command-building methods:

* `exec(...args)` — runs the tool through the local package manager (`pnpm exec`, `npx --no`, etc.) or directly if global
* `dlx(...args)` — runs the tool via the package manager's dlx/npx equivalent without requiring a local install

Both return a `ToolCommand`, a thin wrapper around `@effect/platform` `Command` with instance-method ergonomics (`cmd.string()`, `cmd.lines()`, `cmd.exitCode()`, `cmd.stream()`, `cmd.env()`, `cmd.workingDirectory()`, `cmd.stdin()`).

### Module restructure — single root export, role-based layout

The sub-path exports (`/biome`, `/config`, `/hooks`, `/publish`, `/tags`, `/versioning`) have been removed. All public APIs are now available from the single root import:

```typescript
// Before (v0.1.x)
import { ManagedSection } from "@savvy-web/silk-effects/hooks";
import { TagStrategy } from "@savvy-web/silk-effects/tags";

// After (v0.2.0+)
import { ManagedSection, TagStrategy } from "@savvy-web/silk-effects";
```

Source files are reorganized into four role-based folders: `errors/`, `schemas/`, `services/`, and `utils/`. Unit tests are co-located with their source file.

## 0.1.0

### Features

* [`d553939`](https://github.com/savvy-web/systems/commit/d5539392f70a56ada8b035313fa2d11c98fa5bde) Introduces `@savvy-web/silk-effects`, a platform-agnostic Effect library that consolidates shared Silk Suite conventions into a single package consumed across the ecosystem. The library is built on `@effect/platform` and requires `effect` as a peer dependency -- consumers supply their own platform layer.

### Publish -- Multi-Registry Target Resolution

The `./publish` module resolves raw publish-target values into fully-normalized `ResolvedTarget` records. Supported input forms are the shorthand strings `"npm"`, `"github"`, and `"jsr"`, arbitrary `https://` registry URLs, and structured `PublishTargetObject` values. Auth strategy (`oidc` vs `token`) and token environment variable names are derived automatically from the registry URL.

The module also ships `SilkPublishabilityPlugin`, a plugin for `workspaces-effect` that detects whether a workspace package is publishable by inspecting `publishConfig.access` and `private` fields.

```typescript
import {
  TargetResolver,
  TargetResolverLive,
} from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
```

### Versioning -- Changeset Config Reading and Strategy Detection

The `./versioning` module reads `.changeset/config.json` files via `ChangesetConfigReader` and detects whether the config uses Silk-specific extensions (`SilkChangesetConfig`). `VersioningStrategy` maps the config to one of three strategy types: `"single"` (one package), `"fixed-group"` (changesets `fixed` array present), or `"independent"`.

### Tags -- Git Tag Format Determination

The `./tags` module provides `TagStrategy`, which determines whether a repository should use single version tags (`1.2.3`) or scoped package tags (`@scope/pkg@1.2.3`) based on the workspace layout and versioning strategy. The `TagStrategyType` union (`"single" | "scoped"`) is exported for consumers that need to branch on the result.

### Hooks -- Managed Section Pattern for Tool-Owned File Regions

The `./hooks` module implements the managed section pattern: tool-owned regions delimited by `BEGIN {TOOL_NAME} MANAGED SECTION` / `END {TOOL_NAME} MANAGED SECTION` markers inside user-editable files. `ManagedSection` exposes `read`, `write`, `update`, and `isManaged` operations that preserve everything outside the markers while replacing managed content. Comment style (`"#"` or `"//"`) is configurable.

### Config -- Config File Discovery with `lib/configs/` Priority

The `./config` module provides `ConfigDiscovery`, which locates config files using a two-level search. When a `lib/configs/` directory contains the target file, it takes priority over the repo root -- the Silk convention for centralizing shared configs in a workspace. The resolved `ConfigLocation` includes both the file path and the `ConfigSource` (`"lib" | "root"`).

### Biome -- `$schema` URL Synchronization

The `./biome` module provides `BiomeSchemaSync`, which scans `biome.json` and `biome.jsonc` files in the working directory and updates their `$schema` field to point to the canonical versioned URL for the target Biome release. `BiomeSyncResult` reports each file as `updated`, `current`, or `skipped`.
