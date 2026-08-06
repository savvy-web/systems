---
status: current
module: cli
category: architecture
created: 2026-05-31
updated: 2026-08-05
last-synced: 2026-08-05
completeness: 90
related:
  - ../silk/architecture.md
  - ../silk-effects/architecture.md
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
- [Command tree](#command-tree)
- [The clean command](#the-clean-command)
- [The repos group](#the-repos-group)
- [The runtime layer stack](#the-runtime-layer-stack)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/cli` owns the `savvy` binary and the statically-defined command tree. Almost all of its business logic lives elsewhere: every command handler imports the work it does from `@savvy-web/silk-effects`, and the package exists mainly to wire those handlers into a single `effect/unstable/cli` tree and provide the runtime layer stack that satisfies their service requirements. The lone exception is `savvy clean`, whose filesystem artifact removal has no `silk-effects` equivalent and lives in `src/commands/clean.ts` (see [The clean command](#the-clean-command)).

**Package:** `@savvy-web/cli`, in `packages/cli`.

**Bin:** `savvy` resolves through `src/bin/cli.ts` to `runCli()` in `src/cli/index.ts`.

**Versioning:** independent. cli is no longer in a `fixed` group with `@savvy-web/silk`, but silk stays tightly coupled: silk declares cli as a `workspace:*` source dependency, changesets treats that as cli's exact current version, so every cli release pushes silk's dep out of range and auto-PATCH-bumps silk (via the repo-wide `updateInternalDependencies: patch`), re-pinning silk's exact cli dependency at publish. See `../silk/architecture.md`.

It builds via `@savvy-web/bundler` through a front-door `savvy.build.ts`. The CLI keeps its runtime deps external rather than bundling them (tsdown auto-externalizes everything declared in `dependencies`), and `meta` is off because the package ships a binary, not a documented API surface. `publishConfig` links `dist/dev/pkg` for development and roots the tarball at `dist/prod/npm/pkg`. See `../bundler/architecture.md`.

## Command tree

The tree is static — no runtime discovery, no contribution manifest, no per-command "is the system configured" gate. Commands assume the system is set up (`savvy init` is what sets it up). See `src/cli/index.ts` for the root assembly and `src/commands/` for the handlers.

```text
savvy init        orchestrator → changeset · commit · lint init in one pass
savvy check       orchestrator → runs all three checks
savvy clean       remove build/cache artifacts across the workspace
savvy commit      hook(session-start · pre-commit-message ·
                  post-commit-verify)
savvy changeset   lint · check · transform · validate-file · version ·
                  config(validate) · deps(detect · regen — thin adapters
                  over silk-effects' Changesets.DepsRegen)
savvy lint        fmt(package-json · pnpm-workspace · yaml)
savvy repos       status(--json · --drift) · sync · pin · add · note ·
                  remove · rename · restore
```

The `repos` group (`src/commands/repos/`) is a thin adapter surface over silk-effects' `Repos` namespace — see [The repos group](#the-repos-group).

The root `savvy init` and `savvy check` orchestrators are the only setup and validation entry points — there are no per-tool `init`/`check` subcommands on the three groups. Each group lives under `src/commands/{commit,changeset,lint}/` and exports its group command plus named handler functions. The top-level `init` and `check` orchestrators (`src/commands/init.ts`, `src/commands/check.ts`) sequence the three tool handlers and short-circuit on first failure; the tool handlers are injected so the orchestration logic is unit-testable without a runtime. The plugin hooks and skills shell out to these subcommands.

`savvy clean` (`src/commands/clean.ts`) is a flat top-level command alongside `init` and `check`, registered in the root `withSubcommands` list. It is the one top-level command that carries its own logic rather than delegating to a `silk-effects` handler: filesystem artifact removal needs no service beyond `WorkspaceDiscovery`. See [The clean command](#the-clean-command).

The per-tool `init`/`check` handler functions (`runChangesetInit`, `runChangesetCheck` and their commit/lint siblings) still exist and are exactly what the root orchestrators call. The leaf `initCommand`/`checkCommand` objects also still exist in the leaf files, but only as direct unit-test entry points — the groups no longer pass them to `withSubcommands`. The `savvy check` helpers emit `savvy init` as their remediation hint.

## The clean command

`savvy clean` removes build and cache artifacts across a silk workspace. It cleans a default pattern set overridable via `--globs`/`-g` (comma-separated); `--dry-run`/`-n` previews without touching disk. The handler `runClean` lives entirely in `src/commands/clean.ts` — this is the only top-level command whose logic does not descend into `silk-effects`.

The flow is: discover packages via `WorkspaceDiscovery.listPackages()`, partition on `isRootWorkspace` so leaves are processed before the root workspace, glob each pattern at the top level of every workspace root, dedup matches across overlapping roots, then delete. Globbing uses Node's native `fs.promises.glob` (no third-party glob dependency); patterns match top-level entries by default, and `**` opts into recursion guarded by a descent filter that skips `node_modules` and `.git`.

Three safety properties are load-bearing and must survive any edit. Containment: every match is `realpath`-resolved and rejected unless it stays within its workspace root, so symlinks and `..` cannot escape. The workspace root directory itself and its `package.json` are never removed. Removal runs via `fs.promises.rm({ recursive, force })` under bounded concurrency, leaves before the root; per-target failures are collected rather than thrown, and a non-empty failure set produces a non-zero exit without aborting the remaining deletions.

`clean` adds no new runtime layers. `runClean` requires only `WorkspaceDiscovery`, already present in `AppLive`. The two filesystem-touching units — `collectTargets` (glob plus containment) and `removeTargets` (deletion) — are unit-tested against temp-dir fixtures; `runClean` is tested against a stubbed `WorkspaceDiscovery` layer.

## The repos group

`savvy repos` (`src/commands/repos/`) covers the whole vendored-reference-repo lifecycle, one thin handler per `Repos.ReposManager` method: `status`, `sync`, `pin`, `add`, `note`, `remove <name>`, `rename <old> <new>` and `restore [names...]`. The business logic is entirely in silk-effects (see `../silk-effects/architecture.md#vendored-repos-repos-namespace`); these handlers decode flags, render, and set exit codes.

Three things about the group are load-bearing:

- **`status --drift` is two reads, in order.** The plain status report renders first (`ReposManager.status`), then `Repos.ReposDrift.check` reconciles the manifest, `.gitmodules`, the worktree and `git submodule status`, printing one line per finding (`<name>: <kind> — <detail>`). Either an unclean status report or any drift flips `process.exitCode` to 1, mirroring the pre-existing `!clean` rule. Both calls read the same manifest, so a missing manifest fails at the status call before the drift check runs — the friendly "nothing vendored yet" exit-0 case is unchanged by `--drift`. `--json` emits the structured report instead of the rendered text.
- **`restore` is the destructive one.** It hard-resets a vendored checkout back to its staged (or committed) gitlink commit and re-applies sparse paths, discarding uncommitted work by design. With no names it restores every dirty repo and reports the ones it skipped as clean; with explicit names it restores exactly those, clean or not, after validating that every name exists so a typo in a later name cannot leave earlier ones already reset.
- **Each handler `catchTag`s the FULL error union its `ReposManager` method can produce** — `ReposConfigError`, `GitSubmoduleError`, `RepoNotFoundError`, `NoteNotFoundError`, and `ReposLockdownError` for the six ops that unlock/re-lock the tree — down to a logged message and a non-zero exit code. Consequently `reposCommand`'s hand-written error annotation is `Repos.GitSubmoduleError` alone: the only channel left uncaught is the one `status`/`status --drift` let escape. Its requirements annotation names `Repos.ReposManager | Repos.ReposDrift`, the latter purely because of `status --drift` (see [Why some command groups carry a hand-written type annotation](#why-some-command-groups-carry-a-hand-written-type-annotation)).

`ReposGroup` in the layer stack provides `Repos.ReposLockdown` alongside `ReposConfigStore`/`Git` because the mutating ops apply the OS-level permissions boundary; `Repos.ReposDrift` needs no lockdown, being read-only.

## The runtime layer stack

This is the load-bearing part of the package. The whole runtime layer stack is assembled once in `runCli()` (`src/cli/index.ts`) and is the union of the three source CLIs' stacks with every inter-layer dependency wired. Read that file before touching layer wiring; the structure below is the topology, not a re-listing of every service.

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
              SilkPublishabilityDetector)

WorkspaceLive = WorkspaceRoot + PackageManagerDetector
                + WorkspaceDiscovery(provided WorkspaceRoot)
```

Four structural choices matter:

- **`provideMerge`, not `provide`.** Base services are merged so they are both fed to the upper services and re-exposed in the final context for handlers that yield those tags directly. A service built once via `provideMerge` (notably `Changesets.ConfigInspector`, shared by `BranchAnalyzer`, the surviving `config validate` handler, `ReleasePlanner` and now `Changesets.DepsRegen` — the `classify`/`config show`/`analyze-branch`/`release-surface` CLI commands are gone, so `ConfigInspector` is otherwise consumed by the MCP tools `changeset_inspect`/`changeset_validate`) is never constructed twice per run. `Changesets.ReleasePlanner` backs `savvy changeset version`, which now natively applies the release — bumping versions, transforming CHANGELOGs and updating versionFiles via `ReleasePlanner.apply` — rather than shelling out to a `changeset` binary or detecting the package manager; `--dry-run` is a true no-write report. See `../silk-effects/architecture.md`. `ConfigInspector.layer` requires `FileSystem` (alongside `ChangesetConfigReader` and `WorkspaceDiscovery`) for its release-surface fallback when no explicit `packages` record is configured; `NodeServices.layer` already satisfies it. See `../silk-effects/architecture.md`.
- **Minimal workspace wiring.** `WorkspaceLive` hand-wires the `WorkspaceRoot` / `WorkspaceDiscovery` / `PackageManagerDetector` trio from `@effected/workspaces` rather than pulling in a batteries-included workspace layer, which would also fork `DependencyGraph` / `PublishabilityDetector` background work most commands do not need. `Git.layer` (from `@effected/git`) is likewise built once in `BaseLive` and re-exposed, because it backs `BranchAnalyzer`, `ReposManager`, the commit hooks and `detectGitHubRepo` alike.
- **Tool discovery and section management are kit layers, not silk-effects layers.** `ToolDiscovery` comes from `@effected/commands` and its `LocalExec` contract — the argv prefix that runs a project-local binary — is satisfied by `@effected/workspaces`' `Workspaces.localExecLayer()`, which reads the already-wired `PackageManagerDetector` + `WorkspaceRoot`. Both `localExecLayer()` and `ToolDiscovery.layer` are bound to `const`s so the single reference memoizes into one discovery instance (and one probe cache) per process. `ManagedSection` likewise comes from `@effected/templates` as `ManagedSection.layer`. There is no `VersioningStrategyLive` any more: versioning classification is a pure kit value operation over `WorkspaceDiscovery` plus the silk `PublishabilityDetector`, so `savvy commit check`'s `detectReleaseFormat` calls `VersioningStrategy.detect({ fixedGroups })` — reading `fixedGroups` from the changeset config — with no layer of its own, and the hand-rolled publishability filter it used to apply is gone (the detector layer is now what decides what publishes). See `../silk-effects/architecture.md#what-the-kit-owns-now`.
- **`DepsRegen` is deliberately NOT in `AppLive`.** Its graph is root-bound at layer *build* time, so binding it once at startup would freeze it to the CLI's launch cwd and ignore a command's `--cwd`. The `savvy changeset deps regen`/`deps detect` handlers instead compose `Changesets.makeDepsRegenDefault({ cwd })` per invocation against their parsed cwd, with platform services flowing up to `NodeServices.layer`. Any future service whose layer construction captures a root belongs on this per-invocation path, not in `AppLive`. See `../silk-effects/architecture.md`.

The CLI version is injected at build time via `process.env.__PACKAGE_VERSION__`.

### Why some command groups carry a hand-written type annotation

A command group built by piping `Command.make` through `Command.withSubcommands` infers a type that references effect's non-exported `Inspectable` module, which cannot survive TypeScript declaration emit (TS4023 "cannot be named"). The fix is to build the group into a private `_nameCommand` and re-export it under an explicit `Command.Command<...>` annotation — see `src/commands/changeset/index.ts` and `src/commands/repos/index.ts`, the two groups that hit this. Sibling groups whose inferred types happen to name only exported modules (`commit`, `lint`) need no annotation and have none; add one only when declaration emit actually fails.

The annotation is exact, never `any`: it restates the group's real Error and Requirements channels so the root layer graph stays compiler-validated. `runCli` provides `AppLive` with no casts, so `tsc` (`types:check`) — not the runtime smoke tests — is the gate that proves every service a handler yields is supplied.

**A group's requirements channel is the union of its subcommands' requirements, not `never`.** `Command.withSubcommands` propagates each subcommand's `R` up into the parent (`R | Exclude<ExtractSubcommandContext<Subcommands>, CommandContext<Name>>`), so `changesetCommand` names `ChildProcessSpawner | ConfigInspector | FileSystem | Path | ReleasePlanner` and `reposCommand` names `Repos.ReposManager | Repos.ReposDrift` (the latter only because `status --drift` runs `ReposDrift.check`). The same annotation discipline applies to the *error* channel, and there it narrowed rather than widened: `reposCommand`'s now reads `Repos.GitSubmoduleError` alone. The mutating handlers (`sync`/`add`/`pin`/`note`/`remove`/`rename`/`restore`) `catchTag` every failure their `ReposManager` method can produce — `ReposLockdownError` included, since six of them unlock and re-lock the vendored tree's OS permissions around their git mutations (see `../silk-effects/architecture.md#vendored-repos-repos-namespace`) — so only the `GitSubmoduleError` that `status`/`status --drift` leave uncaught reaches the group boundary. Earlier Effect v4 betas erased subcommand requirements at the group boundary, so these annotations previously read `never`; a beta bump that changes the propagation rule surfaces as a type error on exactly these two exports, and the fix is to widen the annotation to match — the layer graph itself does not change, since `AppLive` already discharged those services. Note the qualified `ChildProcessSpawner.ChildProcessSpawner`: `effect/unstable/process` re-exports it as a namespace and the package exports map offers no deeper subpath.

### Testing the command handlers

Handler tests run on `@effect/vitest` and provide stub layers per test; the suite-wide conventions are in [../testing/effect-vitest.md](../testing/effect-vitest.md). Two patterns recur here and are worth knowing before adding a test:

- **`layer(Logger.layer([]))` at the suite boundary to silence a command's INFO logging.** This is one of the two sanctioned uses of a memoizing suite-boundary layer: an empty logger set is stateless, so nothing crosses between tests. It stays safe only while the suite also avoids ambient process state — these suites never `chdir`, and each test drives a freshly-created temp dir passed in as an argument. A stateful stub still gets provided per test.
- **Output assertions split by capture mechanism, and that split decides `it.effect` vs `it.live`.** A helper that captures by replacing the Logger (`collectLogs`) works under `it.effect`. A helper that spies on the real `console.log` (`collectStdout`) must use `it.live`, because `it.effect` installs `TestConsole`, which swallows Effect's `Console.log` writes before the spy ever sees them. Choosing wrong yields an empty capture, not an error. See `__test__/commands/repos/status.test.ts`.

## Boundaries and invariants

- **`@savvy-web/cli` never imports `@savvy-web/silk`.** All logic comes from `silk-effects`. This is grep-guarded.
- The real tools (`@biomejs/biome`, `husky`, `@commitlint/*`, `@changesets/cli`, `lint-staged`, `markdownlint-cli2`) are not direct deps; `silk` co-installs them as peers and pnpm's public-hoist-pattern makes them resolvable when `savvy` shells out.
- **Every hook-section id the CLI declares is spelled UPPERCASE.** `@effected/templates` renders a `SectionId` key verbatim into its markers, and the markers already on disk in consumer repos are `SAVVY-COMMIT` / `SAVVY-LINT` / `SAVVY-BASE`. A lowercase key does not error — `check` reports `Absent` and `sync` appends a second block — so the hook silently grows a duplicate. `SECTION_DEF` in `src/commands/commit/init.ts` and the ids in silk-effects' `src/lint/cli/sections.ts` carry the uppercase spelling for exactly this reason; the shared helper in `SavvySections.ts` uppercases on the way in. See `../silk-effects/architecture.md#savvysections-shared-husky-hook-shells`. The status branching that goes with it is the kit's flat `CheckOutcome` (`UpToDate`/`Drifted`/`Absent`), not the old nested `Found` + `isUpToDate` pair, and multi-section writes go through `syncAll`.
- **`savvy commit hook pre-commit-message` inspects two different document kinds, and the rule set is gated on which.** The hook is registered against `git commit`/`--amend` *and* `gh pr create`/`pr edit`, so `Commitlint.parseBashCommand`'s `kind` decides which rules run: the commit-body rules (`forbidden-content`, `verbosity`, `soft-wrap`) apply only to a real commit message, while `plan-leakage` and `closes-trailer` apply to both. A PR description is a markdown document — the ecosystem's canonical release PR body opens a fenced `proposed-squash-commit` block by design, which `forbidden-content` denies outright — so ungated commit-body rules blocked posting the canonical body through `gh`. Any new rule added here has to declare which side of that gate it belongs on. See `src/commands/commit/hooks/pre-commit-message.ts` and `../silk-effects/architecture.md`.
- **`savvy lint fmt <name>` owns argument parsing only — never a second copy of the formatting.** Each `fmt` subcommand (`src/commands/lint/fmt.ts`) is the CLI half of a `Lint` handler that lint-staged also invokes directly, so any byte-format step written into the subcommand rather than the handler makes the same file format differently depending on which path ran. `fmt pnpm-workspace` is the case that regressed: it wrote raw `@effected/yaml` stringify output while the handler applied the canonical byte-format step. It now calls `Lint.PnpmWorkspace.formatContent`, the shared static in silk-effects (which produces the repo's byte format directly from `@effected/yaml 0.5.0` — the former Prettier post-process is gone; see `../silk-effects/architecture.md`). When adding a `fmt` subcommand, sort/stringify/normalize belongs behind one silk-effects export both callers share. See `../silk-effects/architecture.md`.
- **`savvy lint`/`savvy check` sync each consumer `biome.json(c)` `$schema` URL to a hardcoded `BIOME_VERSION` const** (`src/commands/lint/biome-version.ts`), via `silk-effects`' `BiomeSchemaSync` service (`check` reports drift, `lint`/`init` writes it). The version source is a plain compiled-in constant, not the never-populated `__BIOME_PEER_VERSION__` env var the path previously read — that env var was always empty, so the sync was a dead no-op until the const replaced it; the path is now active. `BIOME_VERSION` is one of the three coupled Biome-version spots that move together on an upgrade (alongside `@savvy-web/silk`'s Biome asset `$schema` and its `@biomejs/biome` peer range) — see `../silk/architecture.md` and `packages/silk/CLAUDE.md`.
- `silk` depends on `cli` as an exact-pinned regular dependency (install-target wiring), so installing `silk` pulls the `savvy` bin. That arrow points at install topology only — `silk`'s code never imports `cli`.

## Rationale

### Why a thin command host

Within each source package the CLI commands and the config-integration exports share the tool's own internal logic (the changeset `transform` command and the `./remark` export run the same plugins; the changeset `lint` command and the `./markdownlint` export run the same rules). If that logic sat in `silk` and the commands sat in `cli`, `cli` would have to import `silk` — which the topology forbids. The shared logic therefore lives in `silk-effects`, leaving both `cli` and `silk` thin and neither importing the other. See `../silk-effects/architecture.md`.

`changeset init` reflects this same topology in what it writes. The canonical changelog formatter `init` writes into `.changeset/config.json` is the standalone `@savvy-web/changelog` package — an installable id the vanilla changesets CLI can `require()` directly, which silk ships as an exact-pinned dependency (so a silk consumer has it installed) and silk-release-action's native versioning can bundle (see `../changelog/architecture.md`). The markdownlint customRule stays the silk shim `@savvy-web/silk/changesets/markdownlint`. `savvy check` still accepts the prior canonical silk shim path (`@savvy-web/silk/changesets/changelog`) and the pre-merge standalone `@savvy-web/changesets/changelog`, but `init` always writes the canonical entries and migrates a standalone customRule entry to the silk shim. See `src/commands/changeset/commands/init.ts` for the accepted-versus-canonical entry constants.

### Why static, not discovered

A generic `cli` host that discovers contributed commands via a manifest was considered and dropped as premature MCP-era coupling: `cli` statically owns the `savvy` tree. The discovery seam is deferred until a second contributor beyond `@savvy-web/mcp` (such as `github-actions`) needs it.
