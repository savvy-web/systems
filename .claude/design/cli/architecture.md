---
status: current
module: cli
category: architecture
created: 2026-05-31
updated: 2026-06-07
last-synced: 2026-06-07
completeness: 90
related:
  - ../silk/architecture.md
  - ../silk-effects/architecture.md
  - ../mcp/architecture.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/cli architecture

The `savvy` binary — the single command host for the Silk Suite's everyday dev tooling. A thin
command shell over `@savvy-web/silk-effects`, built on `@effect/cli` + `@effect/platform-node`.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Command Tree](#command-tree)
- [The clean command](#the-clean-command)
- [The Runtime Layer Stack](#the-runtime-layer-stack)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/cli` owns the `savvy` binary and the statically-defined command tree. Almost all of its
business logic lives elsewhere: every command handler imports the work it does from
`@savvy-web/silk-effects`, and the package exists mainly to wire those handlers into a single
`@effect/cli` tree and provide the runtime layer stack that satisfies their service requirements. The
lone exception is `savvy clean`, whose filesystem artifact removal has no `silk-effects` equivalent
and lives in `src/commands/clean.ts` (see [The clean command](#the-clean-command)).

**Package:** `@savvy-web/cli`
**Location:** `packages/cli` in `savvy-web/systems`
**Bin:** `savvy` → `src/bin/cli.ts` → `runCli()` in `src/cli/index.ts`
**Versioning:** `fixed` changeset group with `@savvy-web/silk` (they always release together)

This package replaces the three standalone bins `savvy-changesets`, `savvy-commit` and `savvy-lint`
with one. It is the result of Silk Core sub-project 1.

## Current State

Implemented and dogfooded inside `systems`. The command tree is fully assembled in
`src/cli/index.ts`; every legacy subcommand from the three source CLIs survives under its tool
namespace. The acceptance gate (a `pnpm link` into a separate Silk repo exercising changesets/lint/
commitlint live) is sub-project 1's "done" criterion.

`@savvy-web/cli` depends on `@savvy-web/silk-effects` (`workspace:*`), `@effect/cli`,
`@effect/platform`, `@effect/platform-node`, `effect`, plus `workspaces-effect`, `jsonc-effect` and
`yaml`. `private: true` in source; the builder flips it on build via `publishConfig.access`.

It now builds via `@savvy-web/bundler` (M4): a front-door `savvy.build.ts` declaring its runtime
deps as `externals` (the cli keeps them external rather than bundling), with the `publishConfig`
moved to the `dist/dev/pkg` link layout + `dist/prod/npm/pkg` tarball root. The migration also fixed
the silk-effects dogfood bin path to `dist/dev/pkg/bin/savvy.js`. The rslib builder is gone. See
`../bundler/architecture.md`.

## Command Tree

The tree is static — no runtime discovery, no contribution manifest, no per-command "is the system
configured" gate. Commands assume the system is set up (`savvy init` is what sets it up). See
`src/cli/index.ts` for the root assembly and `src/commands/` for the handlers.

```text
savvy init        orchestrator → changeset · commit · lint init in one pass
savvy check       orchestrator → runs all three checks
savvy clean       remove build/cache artifacts across the workspace
savvy commit      hook(session-start · pre-commit-message ·
                  post-commit-verify · user-prompt-submit)
savvy changeset   lint · transform · validate-file · version ·
                  classify · analyze-branch · release-surface ·
                  config(show · validate) · deps(detect · regen)
savvy lint        fmt(package-json · pnpm-workspace · yaml)
```

The root `savvy init` and `savvy check` orchestrators are the *only* setup/validation entry points — there are no per-tool `init`/`check` subcommands on the three groups.

Each group lives under `src/commands/{commit,changeset,lint}/` and exports its group command plus named handler functions (e.g. `runChangesetInit`, `runChangesetCheck`). The top-level `init` and `check` orchestrators (`src/commands/init.ts`, `src/commands/check.ts`) sequence the three tool handlers and short-circuit on first failure; the tool handlers are injected so the orchestration logic is unit-testable without a runtime. The plugin hooks and skills shell out to these subcommands (repointed from the legacy `savvy-changesets …` / `savvy-commit …` paths).

`savvy clean` (`src/commands/clean.ts`) is a flat top-level command alongside `init` and `check`, registered in the root `withSubcommands` list. It is the one top-level command that carries its own logic rather than delegating to a `silk-effects` handler: filesystem artifact removal has no equivalent in `silk-effects` and needs no service beyond `WorkspaceDiscovery`. See [The clean command](#the-clean-command).

The per-tool `init`/`check` leaves are *not* wired into the CLI tree. Their `runChangesetInit`/`runChangesetCheck`/`runCommitInit`/`runCommitCheck`/`runLintInit`/`runLintCheck` handler functions still exist and are exactly what the root orchestrators call. The leaf `initCommand`/`checkCommand` `Command` objects also still exist in the leaf files, but only as direct unit-test entry points (`initCommand.handler(...)`) — the groups no longer pass them to `withSubcommands`. The `savvy check` helpers emit `savvy init` as their remediation hint (not the retired `savvy lint init` / `savvy commit init`).

## The clean command

`savvy clean` removes build and cache artifacts across a silk workspace. It defaults to the patterns `dist`, `.turbo`, `coverage`, `node_modules` and `.rslib`, overridable via `--globs`/`-g` (comma-separated). `--dry-run`/`-n` previews without touching disk. The handler `runClean` lives entirely in `src/commands/clean.ts` — this is the only top-level command whose logic does not descend into `silk-effects`.

The flow is: discover packages via `WorkspaceDiscovery.listPackages()`, partition on `isRootWorkspace` so leaves are processed before the root workspace, glob each pattern at the top level of every workspace root, dedup matches across overlapping roots, then delete. Globbing uses Node's native `fs.promises.glob` (no third-party glob dependency); patterns match top-level entries by default, and `**` opts into recursion guarded by a descent filter that skips `node_modules` and `.git`.

Three safety properties are load-bearing and must survive any edit. Containment: every match is `realpath`-resolved and rejected unless it stays within its workspace root, so symlinks and `..` cannot escape. The workspace root directory itself and its `package.json` are never removed. Removal runs via `fs.promises.rm({ recursive, force })` under bounded concurrency, leaves before the root; per-target failures are collected rather than thrown, and a non-empty failure set produces a non-zero exit without aborting the remaining deletions.

`clean` adds no new runtime layers. `runClean` requires only `WorkspaceDiscovery`, already present in `AppLive`. The two filesystem-touching units, `collectTargets` (glob + containment) and `removeTargets` (deletion), are unit-tested against temp-dir fixtures; `runClean` is tested against a stubbed `WorkspaceDiscovery` layer.

## The Runtime Layer Stack

This is the load-bearing part of the package. The whole runtime layer stack is assembled once in
`runCli()` (`src/cli/index.ts`) and is the union of the three source CLIs' stacks with every
inter-layer dependency wired. Read that file before touching layer wiring; the structure below is
the topology, not a re-listing of every service.

```text
AppLive = mergeAll(ToolDiscovery, VersioningStrategy, Inspector+Analyzer)
            provideMerge(BaseLive)
            provideMerge(NodeContext.layer)

BaseLive  = WorkspaceLive + ChangesetConfigReader + leaf silk-effects services
            (ManagedSection, BiomeSchemaSync, ConfigDiscovery,
             SilkPublishabilityDetector, Changesets.WorkspaceSnapshotReader)

WorkspaceLive = WorkspaceRoot + PackageManagerDetector
                + WorkspaceDiscovery(provided WorkspaceRoot)
```

Two structural choices matter:

- **`provideMerge`, not `provide`.** Base services are merged so they are both fed to the upper
  services *and* re-exposed in the final context for handlers that yield those tags directly. A
  service built once via `provideMerge` (notably `Changesets.ConfigInspector`, shared by
  `BranchAnalyzer` and the `classify`/`config` handlers) is never constructed twice per run.
- **Minimal workspace wiring.** `WorkspaceLive` hand-wires the `WorkspaceRoot` /
  `WorkspaceDiscovery` / `PackageManagerDetector` trio rather than pulling in the heavier
  `WorkspacesLive`, which would also fork `DependencyGraph` / `PublishabilityDetector` background
  work the CLI does not need. This mirrors the three source CLIs.

The CLI version is injected at build time via `__PACKAGE_VERSION__`.

### Why runtime smoke tests verify completeness, not tsgo

The command groups are exported typed as `Command.Command<"name", any, any, any>` (see the cast in
`src/commands/changeset/index.ts` and siblings). The `any` R-channel is deliberate: Effect's
`@effect/cli` command types infer internal types that cannot survive TypeScript declaration emit
(TS4023 "cannot be named" / unexportable-type errors). Casting to `any` is the escape hatch.

The consequence: because the R-channel is `any`, the type-checker **cannot** prove that `AppLive`
supplies every service the handlers require. The cast in `runCli` restores the fully-provided shape,
but the real layer-completeness gate is the **runtime smoke tests**, not `tsgo`. If a handler yields
a tag no layer provides, the type-checker stays silent and the CLI fails at runtime — so the smoke
tests that actually run each command are the contract that the layer stack is complete. Treat them
as such when adding a command that needs a new service.

## Boundaries and Invariants

- **`@savvy-web/cli` never imports `@savvy-web/silk`.** All logic comes from `silk-effects`. This is
  grep-guarded.
- The real tools (`@biomejs/biome`, `husky`, `@commitlint/*`, `@changesets/cli`, `lint-staged`,
  `markdownlint-cli2`) are not direct deps; `silk` co-installs them as peers and pnpm's
  public-hoist-pattern makes them resolvable when `savvy` shells out.
- `silk` peerDeps `cli` (install-target wiring), so installing `silk` pulls the `savvy` bin. That
  arrow points at install topology only — `silk`'s code never imports `cli`.

## Rationale

### Why a thin command host

Within each source package the CLI commands and the config-integration exports share the tool's own
internal logic (the changeset `transform` command and the `./remark` export run the same plugins;
the changeset `lint` command and the `./markdownlint` export run the same rules). If that logic sat
in `silk` and the commands sat in `cli`, `cli` would have to import `silk` — which the topology
forbids. The shared logic therefore descended into `silk-effects`, leaving both `cli` and `silk`
thin and neither importing the other. See `silk-effects/architecture.md` for the extraction.

`changeset init` reflects this same topology in what it *writes*. Consumers install only `@savvy-web/silk`, so `init` writes the silk shim paths into a consumer's `.changeset/config.json` and `.markdownlint-cli2.jsonc` — the changelog formatter `@savvy-web/silk/changesets/changelog` and the markdownlint customRule `@savvy-web/silk/changesets/markdownlint`. `savvy check` accepts both the silk path and the legacy `@savvy-web/changesets/*` path (backward compat), but `init` always writes the silk path and migrates a legacy customRule entry to it (dropping duplicates). Writing the standalone specifier would regress a silk-only consumer to reference a package it does not install. See `src/commands/changeset/commands/init.ts` for the accepted-vs-canonical entry constants.

### Why static, not discovered

The parent Silk Core spec envisioned a *generic* `cli` host that discovers contributed commands via
a manifest. Sub-project 1 deliberately drops discovery and the contribution contract as premature
MCP-era coupling: `cli` statically owns the `savvy` tree. The discovery seam returns in sub-project
2 when `@savvy-web/mcp` and a second contributor (`github-actions`) arrive.
