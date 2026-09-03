---
status: current
module: cli
category: architecture
created: 2026-05-31
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./repos-group.md
  - ../silk/architecture.md
  - ../silk-effects/architecture.md
  - ../silk-effects/changesets.md
  - ../silk-effects/hook-sections.md
  - ../changelog/architecture.md
  - ../mcp/architecture.md
  - ../testing/effect-vitest.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/cli architecture

The `savvy` binary — the single command host for the Silk Suite's everyday dev tooling. A thin command shell over `@savvy-web/silk-effects`, built on Effect v4's in-core `effect/unstable/cli` and `@effect/platform-node`.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Command tree](#command-tree)
- [The clean command](#the-clean-command)
- [The runtime layer stack](#the-runtime-layer-stack)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/cli` owns the `savvy` binary and its statically-defined command tree. Almost all of its business logic lives elsewhere: every command handler imports the work it does from `@savvy-web/silk-effects`, and the package exists to wire those handlers into a single `effect/unstable/cli` tree and provide the runtime layer stack that satisfies their service requirements. The lone exception is `savvy clean`, whose filesystem artifact removal has no `silk-effects` equivalent (see [The clean command](#the-clean-command)).

**Package:** `@savvy-web/cli`, in `packages/cli`.

**Bin:** `savvy` resolves through `src/bin/cli.ts` to `runCli()` in `src/cli/index.ts`.

**Versioning:** independent. `@savvy-web/silk` declares cli as a `workspace:*` source dependency, which changesets reads as cli's exact current version, so every cli release pushes silk's dependency out of range and auto-PATCH-bumps silk (the repo-wide `updateInternalDependencies: patch`), re-pinning it at publish. See `../silk/architecture.md`.

**Build:** `@savvy-web/bundler` through a front-door `savvy.build.ts`. Runtime deps stay external (tsdown auto-externalizes everything declared in `dependencies`), and `meta` is off because the package ships a binary, not a documented API surface. `publishConfig` links `dist/dev/pkg` for development and roots the tarball at `dist/prod/npm/pkg`. See `../bundler/architecture.md`.

## Current State

Shipped and in daily use as `@savvy-web/cli` 2.9.x: seven top-level commands (`init`, `check`, `clean`, `commit`, `changeset`, `lint`, `repos`), one runtime layer stack in `src/cli/index.ts`, and a handler test suite under `__test__/` on `@effect/vitest`. No discovery seam, no per-tool `init`/`check` subcommands, no `peerDependencies`. The package versions independently and is built by `@savvy-web/bundler` with `meta` off.

## Command tree

The tree is static — no runtime discovery, no contribution manifest, no per-command "is the system configured" gate. Commands assume the system is set up; `savvy init` is what sets it up. `src/cli/index.ts` assembles the root; `src/commands/` holds the handlers.

```text
savvy init        orchestrator → changeset · commit · lint init in one pass
savvy check       orchestrator → runs all three checks
savvy clean       remove build/cache artifacts across the workspace
savvy commit      hook(session-start · pre-commit-message · post-commit-verify)
                  · lint <file>
savvy changeset   lint · check · transform · validate-file · version
                  · config(validate) · deps(detect · regen)
savvy lint        fmt(package-json · pnpm-workspace · yaml)
savvy repos       status · sync · pin · add · note · remove · rename
                  · restore · deregister
```

`savvy init` and `savvy check` (`src/commands/init.ts`, `src/commands/check.ts`) are the only setup and validation entry points; the three tool groups expose no per-tool `init`/`check` subcommands. Each group under `src/commands/{commit,changeset,lint}/` exports its group command plus the named `run*Init`/`run*Check` handler functions the orchestrators sequence, short-circuiting on first failure. The handlers are injected as parameters, so the orchestration logic is unit-testable without a runtime, and every `check` failure names `savvy init` as its remediation. The `plugins/silk` hooks and skills shell out to these subcommands.

`savvy commit lint <file>` answers "would this message pass?" by running the real commitlint preset over a candidate message file (`src/commands/commit/lint.ts`), as opposed to the advisory heuristics behind `commit hook pre-commit-message`.

`savvy changeset version` natively applies the pending release through silk-effects' `Changesets.ReleasePlanner.apply` — bumping versions, transforming CHANGELOGs and updating `versionFiles` — with no `changeset` binary shell-out; `--dry-run` is a true no-write report. `version` and `transform` refuse to run on an invalid `.changeset/config.json` via the shared gate in `src/commands/changeset/utils/config-gate.ts` (an absent config passes, so un-bootstrapped projects still work); `lint` deliberately skips the gate so it keeps working while a config fix is in progress. `deps detect`/`deps regen` are thin adapters over `Changesets.DepsRegen`.

`savvy repos` is the CLI half of the vendored-reference-repo lifecycle and has its own doc: [repos-group.md](./repos-group.md).

## The clean command

`savvy clean` (`src/commands/clean.ts`) removes build and cache artifacts across a silk workspace. It is the one top-level command that carries its own logic rather than delegating to a `silk-effects` handler: artifact removal needs no service beyond `WorkspaceDiscovery`, already in `AppLive`, so it adds no runtime layers. A default pattern set is overridable via `--globs`/`-g`; `--dry-run`/`-n` previews without touching disk.

The flow is: discover packages via `WorkspaceDiscovery.listPackages()`, partition on `isRootWorkspace` so leaves are processed before the root, glob each pattern at the top level of every workspace root, dedup matches across overlapping roots, then delete. Globbing uses Node's native `fs.promises.glob` (no third-party glob dependency); patterns match top-level entries, and `**` opts into recursion guarded by a descent filter that skips `node_modules` and `.git`.

Three safety properties are load-bearing and must survive any edit:

- **Containment.** Every match is `realpath`-resolved and rejected unless it stays within its workspace root, so symlinks and `..` cannot escape.
- **The workspace root directory itself and its `package.json` are never removed.**
- **Failures are collected, not thrown.** Removal runs via `fs.promises.rm({ recursive, force })` under bounded concurrency, leaves before the root; a non-empty failure set produces a non-zero exit without aborting the remaining deletions.

The two filesystem-touching units — `collectTargets` (glob plus containment) and `removeTargets` (deletion) — are unit-tested against temp-dir fixtures; `runClean` is tested against a stubbed `WorkspaceDiscovery` layer.

## The runtime layer stack

This is the load-bearing part of the package. The whole stack is assembled once in `runCli()` (`src/cli/index.ts`) with every inter-layer dependency wired. Read that file before touching layer wiring; the structure below is the topology, not a re-listing of every service.

```text
AppLive = mergeAll(ToolDiscoveryGroup, Inspector+Analyzer, ReposGroup)
            provideMerge(BaseLive)
            provideMerge(NodeServices.layer)

ToolDiscoveryGroup = ToolDiscovery.layer            ← @effected/commands
                       provide(Workspaces.localExecLayer())
                       provide(WorkspaceLive)

Inspector+Analyzer = BranchAnalyzer
                       provideMerge(ReleasePlanner)
                       provideMerge(ConfigInspector)

ReposGroup = mergeAll(Repos.ReposManager, Repos.ReposDrift)
               provide(Repos.ReposConfigStore)
               provide(Repos.ReposLockdown)   ← ReposManager only
               provide(Git)

BaseLive  = WorkspaceLive + Git + ChangesetConfigReader
            + ManagedSection.layer (@effected/templates)
            + leaf silk-effects services (BiomeSchemaSync, ConfigDiscovery,
              SilkPublishability)

WorkspaceLive = WorkspaceRoot + PackageManagerDetector
                + WorkspaceDiscovery(provided WorkspaceRoot)
```

Four structural choices matter:

- **`provideMerge`, not `provide`.** Base services are merged so they are both fed to the upper services and re-exposed in the final context for handlers that yield those tags directly. A service built once via `provideMerge` is never constructed twice per run — notably `Changesets.ConfigInspector`, shared by `BranchAnalyzer`, `ReleasePlanner` and the `config validate` handler. `ConfigInspector.layer` requires `FileSystem` alongside `ChangesetConfigReader` and `WorkspaceDiscovery`; `NodeServices.layer` satisfies it. See `../silk-effects/architecture.md`.
- **Minimal workspace wiring.** `WorkspaceLive` hand-wires the `WorkspaceRoot` / `WorkspaceDiscovery` / `PackageManagerDetector` trio from `@effected/workspaces` rather than a batteries-included workspace layer, which would also fork `DependencyGraph` / `PublishabilityDetector` background work most commands do not need. `WorkspaceDiscovery.layer()` resolves its root lazily from the CLI's startup cwd, the single-root semantics every downstream consumer assumes. `Git.layer` (from `@effected/git`) is likewise built once in `BaseLive` and re-exposed, because it backs `BranchAnalyzer`, `ReposManager`, the commit hooks and `detectGitHubRepo` alike.
- **Tool discovery and section management are kit layers, not silk-effects layers.** `ToolDiscovery` comes from `@effected/commands`; its `LocalExec` contract — the argv prefix that runs a project-local binary — is satisfied by `@effected/workspaces`' `Workspaces.localExecLayer()`, which reads the already-wired `PackageManagerDetector` + `WorkspaceRoot`. Both `localExecLayer()` and `ToolDiscovery.layer` are bound to `const`s so the single reference memoizes into one discovery instance (and one probe cache) per process. `ManagedSection` comes from `@effected/templates`. Versioning classification has no layer at all: `savvy commit check`'s `detectReleaseFormat` calls `VersioningStrategy.detect({ fixedGroups })` — a pure kit value operation over `WorkspaceDiscovery` plus the silk `PublishabilityDetector`, with `fixedGroups` read from the changeset config. See `../silk-effects/architecture.md#what-the-kit-owns`.
- **`DepsRegen` is deliberately NOT in `AppLive`.** Its graph is root-bound at layer *build* time, so binding it once at startup would freeze it to the CLI's launch cwd and ignore a command's `--cwd`. The `deps regen`/`deps detect` handlers instead compose `Changesets.makeDepsRegenDefault({ cwd })` per invocation against their parsed cwd, with platform services flowing up to `NodeServices.layer`. The services themselves are documented in `../silk-effects/changesets.md`. Any future service whose layer construction captures a root belongs on this per-invocation path, not in `AppLive`.

The CLI version is injected at build time via `process.env.__PACKAGE_VERSION__`.

### Why some command groups carry a hand-written type annotation

A command group built by piping `Command.make` through `Command.withSubcommands` infers a type that references effect's non-exported `Inspectable` module, which cannot survive TypeScript declaration emit (TS4023 "cannot be named"). The fix is to build the group into a private `_nameCommand` and re-export it under an explicit `Command.Command<...>` annotation — see `src/commands/changeset/index.ts` and `src/commands/repos/index.ts`, the two groups that hit this. Sibling groups whose inferred types happen to name only exported modules (`commit`, `lint`) need no annotation and have none; add one only when declaration emit actually fails.

The annotation is exact, never `any`: it restates the group's real Error and Requirements channels so the root layer graph stays compiler-validated. `runCli` provides `AppLive` with no casts, so `tsc` (`types:check`) — not the runtime smoke tests — is the gate that proves every service a handler yields is supplied.

**A group's requirements channel is the union of its subcommands' requirements, not `never`.** `Command.withSubcommands` propagates each subcommand's `R` up into the parent, so `changesetCommand` names `ChildProcessSpawner | ConfigInspector | FileSystem | Path | ReleasePlanner`, and `reposCommand` names `Repos.ReposManager | Repos.ReposDrift` (the latter only because `status --drift` runs `ReposDrift.check`). The same discipline applies to the error channel, where the handlers' `catchTag` coverage narrows it — `reposCommand`'s reads `Repos.GitSubmoduleError` alone (see [repos-group.md](./repos-group.md)). A beta bump that changes the propagation rule surfaces as a type error on exactly these two exports; the fix is to widen the annotation to match, since `AppLive` already discharges those services and the layer graph does not change. Note the qualified `ChildProcessSpawner.ChildProcessSpawner`: `effect/unstable/process` re-exports it as a namespace and the package exports map offers no deeper subpath.

### Testing the command handlers

Handler tests run on `@effect/vitest` and provide stub layers per test; the suite-wide conventions are in [../testing/effect-vitest.md](../testing/effect-vitest.md). Two patterns recur here and are worth knowing before adding a test:

- **`Logger.layer([])` at the suite boundary to silence a command's INFO logging.** This is one of the two sanctioned uses of a memoizing suite-boundary layer: an empty logger set is stateless, so nothing crosses between tests. It stays safe only while the suite also avoids ambient process state — these suites never `chdir`, and each test drives a freshly-created temp dir passed in as an argument. A stateful stub still gets provided per test.
- **Output assertions split by capture mechanism, and that split decides `it.effect` vs `it.live`.** A helper that captures by replacing the Logger (`collectLogs`) works under `it.effect`. A helper that spies on the real `console.log` (`collectStdout`) must use `it.live`, because `it.effect` installs `TestConsole`, which swallows Effect's `Console.log` writes before the spy ever sees them. Choosing wrong yields an empty capture, not an error. See `__test__/commands/repos/status.test.ts`.

## Boundaries and invariants

- **`@savvy-web/cli` never imports `@savvy-web/silk` or `@savvy-web/mcp`.** All logic comes from `silk-effects`. This is grep-guarded.
- **No `peerDependencies` block.** The Effect closure is sealed as regular `dependencies` (the same posture as mcp and tsdown-plugins). A new `@effect/*` dep declares its required peers as regular deps too.
- The real tools (`@biomejs/biome`, `husky`, `@commitlint/*`, `@changesets/cli`, `lint-staged`, `markdownlint-cli2`) are not direct deps; `silk` co-installs them as peers and pnpm's public-hoist-pattern makes them resolvable when `savvy` shells out.
- **Every hook-section id the CLI declares is spelled UPPERCASE.** `@effected/templates` renders a `SectionId` key verbatim into its markers, and the markers already on disk in consumer repos are `SAVVY-COMMIT` / `SAVVY-LINT` / `SAVVY-BASE`. A lowercase key does not error — `check` reports `Absent` and `sync` appends a second block — so the hook silently grows a duplicate. `SECTION_DEF` in `src/commands/commit/init.ts` and the ids in silk-effects' `src/lint/cli/sections.ts` carry the uppercase spelling for exactly this reason; the shared sections in `SavvySections.ts` uppercase on the way in. Status branching uses the kit's flat `CheckOutcome` (`UpToDate`/`Drifted`/`Absent`), and multi-section writes go through `syncAll`. See `../silk-effects/hook-sections.md`.
- **The hygiene hooks carry the toolchain drift check, except `post-commit`.** Both `commit init` and `lint init` sync silk-effects' `SavvyHooksSection` into `.husky/post-checkout`, `post-merge` and `post-commit`, and add `SavvyToolchainSection` (the package-manager drift warning) to the first two only — they fire exactly when a pin bump or branch switch can make the local package manager stale, whereas `post-commit` fires on every commit, noisier than the drift warrants. The matching `check` handlers skip `post-commit` for the toolchain section for the same reason.
- **`savvy commit hook pre-commit-message` inspects two different document kinds, and the rule set is gated on which.** The hook is registered against `git commit`/`--amend` *and* `gh pr create`/`pr edit`, so `Commitlint.parseBashCommand`'s `kind` decides which rules run: the commit-body rules (`forbidden-content`, `verbosity`, `soft-wrap`) apply only to a real commit message, while `plan-leakage` and `closes-trailer` apply to both. A PR description is a markdown document — the ecosystem's canonical release PR body opens a fenced `proposed-squash-commit` block by design, which `forbidden-content` denies outright. Any new rule added here has to declare which side of that gate it belongs on. See `src/commands/commit/hooks/pre-commit-message.ts`.
- **`savvy lint fmt <name>` owns argument parsing only — never a second copy of the formatting.** Each `fmt` subcommand (`src/commands/lint/fmt.ts`) is the CLI half of a `Lint` handler that lint-staged also invokes directly, so any byte-format step written into the subcommand rather than the handler makes the same file format differently depending on which path ran. `fmt pnpm-workspace` calls `Lint.PnpmWorkspace.formatContent`, `fmt yaml` calls `Lint.Yaml.formatFile` (under `Effect.sync`, because that static is synchronous — the YAML engine is a pure IO-free tier). When adding a `fmt` subcommand, sort/stringify/normalize belongs behind one silk-effects export both callers share.
- **`savvy lint`/`savvy check` sync each consumer `biome.json(c)` `$schema` URL to the hardcoded `BIOME_VERSION` const** (`src/commands/lint/biome-version.ts`) via silk-effects' `BiomeSchemaSync` service — `check` reports drift, `lint`/`init` writes it — across every workspace root (`Lint.Biome.findAllConfigs()`), not just the repository root. `BIOME_VERSION` is one of the three coupled Biome-version spots that move together on an upgrade, alongside `@savvy-web/silk`'s Biome asset `$schema` and its `@biomejs/biome` peer range — see `../silk/architecture.md` and `packages/silk/CLAUDE.md`.
- `silk` depends on `cli` as an exact-pinned regular dependency (install-target wiring), so installing `silk` pulls the `savvy` bin. That arrow points at install topology only — `silk`'s code never imports `cli`.

## Rationale

### Why a thin command host

Within each tool the CLI commands and the config-integration exports share the tool's own internal logic (the changeset `transform` command and silk's `./remark` export run the same plugins; the changeset `lint` command and the `./markdownlint` export run the same rules). If that logic sat in `silk` and the commands sat in `cli`, `cli` would have to import `silk` — which the topology forbids. The shared logic therefore lives in `silk-effects`, leaving both `cli` and `silk` thin and neither importing the other. See `../silk-effects/architecture.md`.

`changeset init` reflects this same topology in what it writes. The canonical changelog formatter written into `.changeset/config.json` is the standalone `@savvy-web/changelog` package — an installable id the vanilla changesets CLI can `require()` directly, which silk ships as an exact-pinned dependency (see `../changelog/architecture.md`). The markdownlint customRule is the silk shim `@savvy-web/silk/changesets/markdownlint`. `savvy check` also accepts the legacy ids (`@savvy-web/silk/changesets/changelog`, `@savvy-web/changesets/changelog`, `@savvy-web/changesets/markdownlint`), but `init` always writes the canonical entries. See the `*_ENTRY` constants in `src/commands/changeset/commands/init.ts`.

### Why static, not discovered

A generic `cli` host that discovers contributed commands via a manifest was considered and dropped as premature coupling: `cli` statically owns the `savvy` tree. The discovery seam is deferred until a second contributor beyond `@savvy-web/mcp` needs it.
