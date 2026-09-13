---
type: Module
title: silk-effects
description: L2 engine of the Silk package graph — the shared, platform-agnostic Effect library holding Silk's policy and the business logic of six dev-tooling namespaces.
kind: package
resource: ../../packages/silk-effects
status: draft
tags: [architecture]
sources:
  - id: arch
    resource: ../../packages/silk-effects/src
  - id: changesets
    resource: ../../packages/silk-effects/src/changesets
  - id: commitlint
    resource: ../../packages/silk-effects/src/commitlint
  - id: lint
    resource: ../../packages/silk-effects/src/lint
  - id: turbo
    resource: ../../packages/silk-effects/src/turbo
  - id: repos
    resource: ../../packages/silk-effects/src/repos
  - id: workspace-analysis
    resource: ../../packages/silk-effects/src/services
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: f82374ecfc2d486fdaaca036bea23bf24ef0e89d401e0d18b0932d53a5bf86a7
---

# silk-effects

## Boundary

`@savvy-web/silk-effects` (`packages/silk-effects`) is the platform-agnostic Effect library holding the Silk Suite's *policy*: publishability rules, workspace analysis, changeset configuration, the shared husky-hook shells, and the business logic of the dev-tooling namespaces. It is the engine (L2) of the package layering — the one library every front end above it imports: [`cli`](cli.md), [`mcp`](mcp.md), `changelog`, and `silk` — and same-layer packages never reference each other, which is what forces every piece of shared logic to live here. Below it sits [`silk-core`](silk-core.md) (L1), the platform-free domain model this package depends on and re-exports.[^arch]

Two seams govern the package. Policy versus mechanism: generic mechanisms — versioning and tag classification, CLI tool discovery, the managed-section engine, the GitHub issue-reference grammar — live in the `@effected/*` kit; silk-effects layers Silk opinion over them and re-exports nothing from the kit. Engine versus host: shared code here reads nothing from `process`; the `lint/` and `commitlint/` directories are the sole exception, because they are host adapters invoked by lint-staged, markdownlint-cli2, and commitlint — foreign host processes that supply no context.[^arch]

## Owner

Bound by [package-layering](../conventions/package-layering.md) and [effect-v4-code-style](../conventions/effect-v4-code-style.md); shaped by [kit-effect-peers-via-catalog](../decisions/kit-effect-peers-via-catalog.md) and [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md).

## Export surface

All public API ships from the package root (`"."`); there are no sub-path exports. `src/index.ts` is the authoritative listing: six namespaces (`Changesets`, `Commitlint`, `Lint`, `PrBody`, `Repos`, `Turbo`) via `export * as`, plus flat-exported errors, schemas, and services. The errors, schemas, and `PrBody` are re-exported `from "@savvy-web/silk-core"` under the same names and the same type-only/value split, so the surface is byte-for-byte what it was before the L1 extraction.[^arch]

A flat-exported type carries its full type closure flat — the bundler's API Extractor pass fails on forgotten exports. Nothing is re-exported from `@effected/*`: consumers import kit types (`ManagedSection`, `VersioningStrategy`, `ToolDiscovery`, etc.) from their kit packages directly and declare those dependencies themselves.[^arch]

## What silk-core owns instead

[`silk-core`](silk-core.md) holds everything from this package that needs no platform: the five `errors/` classes, the six `schemas/` value objects, the whole `pr-body/` contract, and `trimTrailingSlashes`. silk-effects declares it as a `workspace:*` dependency and re-exports it (except `trimTrailingSlashes`, never public here). Cross-package `{@link}`s are written as backticks in both directions because API Extractor cannot resolve a link through a re-export.[^arch]

## Service pattern

Every service is a `Context.Service` class with a companion exported `*Shape` interface. The `layer` static carries an explicit `Layer.Layer<Service, Error, Requirements>` annotation — an accidentally added requirement is a type error, not a silently wider consumer graph — and passes `this`, never the class's own name, as the constructor's first argument (the class name is in its temporal dead zone at that point and throws at import time).[^arch] Errors are `Data.TaggedError` classes with a `message` getter; serialisable value objects are `Schema.Class`/`Schema.TaggedClass`; non-serialisable values with function-valued fields are plain classes with a private constructor and a static `make()`; discriminated unions that never round-trip through Schema use `Data.taggedEnum`.[^arch]

## Namespaces

### Changesets

`Changesets` (`src/changesets/`, `export * as Changesets`) holds the business logic of the former `@savvy-web/changesets` package: the changeset transformer and linter, the changelog renderer, the remark plugins and markdownlint rules, and the services that inspect config, plan releases, and regenerate dependency changesets. It runs the genuine changesets **v3 engine** at runtime.[^changesets]

- **`ConfigInspector`** resolves `.changeset/config.json` into package scopes and classifies file paths against them, with a release-surface fallback built from `SilkPublishability.detect` when no explicit `packages` record exists, and fixed attribution precedence (directory containment deepest-first, then `additionalScopes`, `versionFiles`, then root-as-package).[^changesets]
- **`ReleasePlanner`** backs `plan`, `preview`, and `apply` with the real `@changesets/get-release-plan` + `@changesets/apply-release-plan` machinery. `apply` is the destructive native release `savvy changeset version` runs — no `changeset` binary shell-out — and is deliberately not exposed over MCP; only `preview` is.[^changesets]
- **`VersionFiles`** patches version files with format-preserving minimal edits through `@effected/jsonc`'s `modify` + `applyEdits`; never a `JSON.parse`/`JSON.stringify` round-trip.[^changesets]
- **`DepsRegen`** (`plan`/`execute`) computes and applies the cumulative dependency-changeset diff between two workspace snapshots (merge-base→worktree by default), cross-seeding catalogs between the two sides so a config-dependency hook injection cannot masquerade as a version change. `DepsRegen.layer` is the injection seam; `DepsRegenDefault` is the batteries-included composition.[^changesets]
- **Changelog rendering** carries no commit-link prefixes (squash-merge workflows make per-changeset commit links point at squash commits) and is AST-native: `renderSectionNode` decides on MDAST node type, never string prefixes. Changeset-less releases render a `### Maintenance` note via the pure `deriveMaintenanceReason`.[^changesets]
- The five `CSH00x` lint rules exist twice — as remark rules and as markdownlint rules — kept from drifting by one shared version pattern (`VERSION_RE`) and one shared `## Dependencies` table scanner (`scanDependencySection`).[^changesets]

### Commitlint

`Commitlint` (`src/commitlint/`, `export * as Commitlint`) holds the config factory and its custom `silk/*` rules, DCO and scope detection, the formatter, the commitizen prompt adapter, and the Claude Code hook logic that `savvy commit hook` runs over an agent's `git commit`/`gh pr` invocations.[^commitlint]

Each rule under `hook/rules/` is an independent `Rule` with its own severity — nothing here composes them into a fixed pipeline. The caller (`savvy commit hook pre-commit-message`) decides which subset runs against which document kind: commit-body rules apply only to a real commit message, while `plan-leakage` and `closes-trailer` apply to both a commit message and a PR body.[^commitlint] `closes-trailer` matches the whole reference list on a trailer line through the kit's `parseClosingLists` — strictly whole-line, all nine GitHub closing tenses count. See [issue-reference-grammar](../interfaces/issue-reference-grammar.md).[^commitlint]

`verbosity`'s exported thresholds encode the plugin's authored commit shape, not a generic style opinion — see [commit-and-pr-messages](../conventions/commit-and-pr-messages.md).[^commitlint]

### Lint

`Lint` (`src/lint/`, `export * as Lint`) holds the business logic of the former `@savvy-web/lint-staged` package: one handler per file kind (`Biome`, `Markdown`, `PackageJson`, `PnpmWorkspace`, `ShellScripts`, `TypeScript`, `Yaml`), the `Preset`/`createConfig` lint-staged configuration builders, and the `SAVVY-LINT` managed-section id the CLI installs.[^lint]

Every handler is reachable two ways — as a lint-staged handler and as a `savvy lint fmt <name>` CLI subcommand — so a handler's byte-format step must be a public static both entry points call, and the operation must be idempotent, or the two paths silently rewrite a file differently.[^lint] `Lint.Yaml` formats user-authored YAML synchronously through `@effected/yaml` (a pure IO-free tier); it has no config-file tier, and `indentSequences` is the option that matters — `quoteStyle` governs only newly-created scalars.[^lint]

### Turbo

`Turbo` (`src/turbo/`, `export * as Turbo`) provides read-only Turborepo introspection. **Every operation invokes `turbo run … --dry=json` and never executes a task** — the namespace's load-bearing safety invariant, backing the MCP `turbo_inspect` tool.[^turbo]

The namespace splits a service for I/O (`TurboInspector` — cache diagnosis, task graph with critical path, affected-set computation) from a pure, all-static transformer (`TurboDigest`) with no DI. Tool discovery is kit-owned (`@effected/commands`' `ToolDiscovery`); environment extension for a spawned command must go through `Run.extendEnv`, never core's bare `setEnv`, which replaces rather than merges the child environment.[^turbo]

### Repos

`Repos` (`src/repos/`, `export * as Repos`) owns the vendored-reference-repo mechanism: a manifest at `.repos/config.json`, git submodules under `.repos/`, and the permissions boundary that keeps those checkouts read-only. It backs `savvy repos` and the MCP `repos_inspect`/`repos_manage` tools.[^repos]

Four services: `ReposConfigStore` (validated manifest read/write, serialized via an exclusive-create lock file), `ReposManager` (the whole lifecycle: `status`, `sync`, `add`, `pin`, `note`, `remove`, `rename`, `restore`, `deregister`), `ReposDrift` (read-only, reconciles five authorities: the manifest, `.gitmodules`, the worktree, `git submodule status`, and the superproject's local git config), and `ReposLockdown` (the boundary itself — `lock` chmods a vendored tree to `0444`/`0555`, `unlock` restores `0644`/`0755`).[^repos]

The OS permissions are the boundary; the plugin's Bash/fs/MCP guards are early-warning UX in front of it — a guard can only pattern-match a command string, a `0444` file has none. The lock covers the worktree only; the submodule's git metadata directory is deliberately left writable, because locking it broke ordinary git tooling (a plain `git pull` recursing into submodules) and clients that keep per-gitdir state. The invariant is "a drifted pin is always detected and one command from repaired," not "the pin cannot drift."[^repos] See [vendored-repos-lockdown](../decisions/vendored-repos-lockdown.md) and [vendored-repos-handling](../conventions/vendored-repos-handling.md).

### Publishability and workspace analysis

The Silk publishability rule, the changeset-config accessors, and the composite workspace analyzer sit over `@effected/workspaces`: the kit supplies discovery, the `PublishTarget` value object, and the versioning/tag value classes; this package supplies Silk's `publishConfig` conventions and one release tool's config file.[^workspace-analysis]

- **`SilkPublishability`** is an all-static class: the pure `detect(pkgName, raw, binding)` recognizes only the bundler's keyed Record-map form of `publishConfig.targets`, taking a parsed `targets.json` binding as its third argument. Precedence is targets-first: a non-empty Record-map `targets` makes the package publishable regardless of `private`; else `publishConfig.access` yields one target; else `private !== true` yields one default public target; else none.[^workspace-analysis]
- **`ChangesetConfigReader`/`ChangesetConfig`** read and decode `.changeset/config.json`; `ChangesetConfig` is total — every accessor has error channel `never`, and a missing or unreadable config collapses to `mode: "none"` with empty defaults. The cache never self-expires; `refresh()` is the escape hatch a long-lived host (the `savvy-mcp` server) calls to observe an on-disk edit.[^workspace-analysis]
- **`SilkWorkspaceAnalyzer`** is the composite: `analyze(root)` discovers packages, detects publishability, classifies versioning, and wires fixed/linked release groups behind one entry point. It reads each package's raw manifest and `targets.json` binding directly rather than depending on a publishability service.[^workspace-analysis]

## Dependencies and platform requirements

`@savvy-web/silk-core` is a regular `workspace:*` dependency. `effect` is the sole framework peer. Three kit packages — `@effected/commands`, `@effected/git`, `@effected/workspaces` — are required peers because their service identities cross this package's API boundary; the rest of the kit are regular dependencies. See [kit-effect-peers-via-catalog](../decisions/kit-effect-peers-via-catalog.md). Consumers provide the platform layer and the working directory — no service defaults to `process.cwd()`.[^arch]

## Related concepts

- [silk-core](silk-core.md) — the L1 domain model this package re-exports
- [cli](cli.md), [mcp](mcp.md) — the two front ends whose command/tool logic this package supplies
- [pr-body-contract](../interfaces/pr-body-contract.md), [managed-hook-sections](../interfaces/managed-hook-sections.md), [issue-reference-grammar](../interfaces/issue-reference-grammar.md) — the frozen contracts this package's `PrBody`, `SavvySections`, and reference-parsing rely on
- [kit-effect-peers-via-catalog](../decisions/kit-effect-peers-via-catalog.md) — why three `@effected/*` packages are required peers

[^arch]: `../../packages/silk-effects/src`
[^changesets]: `../../packages/silk-effects/src/changesets`
[^commitlint]: `../../packages/silk-effects/src/commitlint`
[^lint]: `../../packages/silk-effects/src/lint`
[^turbo]: `../../packages/silk-effects/src/turbo`
[^repos]: `../../packages/silk-effects/src/repos`
[^workspace-analysis]: `../../packages/silk-effects/src/services`
