---
type: Decision
title: Kit Effect peers supplied via the effected catalog
description: "silk-core and silk-effects declare the identity-carrying @effected/* packages (changesets, commands, git, github, templates, workspaces) as required peers, spelled catalog:effected:peers, with ranges supplied by @effected/pnpm-plugin-effected's peers catalog rather than hand-pinned versions."
status: stable
tags: [architecture, release, deps]
sources:
  - id: kit-peers
    resource: ../../packages/silk-effects/package.json
  - id: core-peers
    resource: ../../packages/silk-core/package.json
  - id: core-sections
    resource: ../../packages/silk-core/src/schemas
  - id: workspace
    resource: ../../pnpm-workspace.yaml
  - id: changelog-deps
    resource: ../../packages/changelog/package.json
  - id: github-service
    resource: ../../packages/silk-effects/src/changesets/services/github.ts
  - id: cli-deps
    resource: ../../packages/cli/package.json
  - id: mcp-deps
    resource: ../../packages/mcp/package.json
  - id: silk-deps
    resource: ../../packages/silk/package.json
generated:
  by: okfit/claude-code
  at: 2026-11-12T03:36:35Z
verified:
  - by: human:spencer
    at: 2026-10-07T16:50:25Z
  - by: human:spencer
    at: 2026-10-13T17:19:17Z
  - by: human:spencer
    at: 2026-11-02T21:03:43Z
  - by: human:spencer
    at: 2026-11-10T03:29:57Z
  - by: human:spencer
    at: 2026-11-10T15:51:59Z
  - by: human:spencer
    at: 2026-11-10T15:59:02Z
integrity:
  generated:
    body: fff51690f08d3848
  verified:
    by: human:spencer
    at: 2026-11-10T15:59:02Z
    content: 8c06577de96e63ac
---

# Kit Effect peers supplied via the effected catalog

## Context

[silk-effects](../modules/silk-effects.md) is consumed both directly by the GitHub Actions and transitively through `@savvy-web/silk` → cli/mcp. When a consumer's direct silk-effects pin drifted from the transitive one, the tree carried two silk-effects copies, and as regular `dependencies` each dragged its own copy of the `@effected/*` kit — observed in `silk-release-action`'s lockfile as two silk-effects majors and two `@effected/workspaces`, both bundled into the action artifact. The other kit packages deduped only because the two silk-effects versions happened to pin overlapping ranges — luck, not design.[^kit-peers]

The same question recurs one layer down: [silk-core](../modules/silk-core.md) (L1) exports schemas that extend kit classes, and silk-effects re-exports silk-core, so a kit class that reaches silk-core's public surface reaches every consumer above it.[^core-peers]

## Decision

The criterion is **nominal identity across the exported API**. A kit package is a required peer when a class or `Context.Service` it defines appears in the declaring package's public surface — as a schema base, a service requirement, or a result type — so that two resolved copies would be two distinct type identities. When the shared value is a Schema class, the failure also reaches runtime: a value built from one copy fails `instanceof` and decode against the other even where it type-checks. A kit package is a regular `dependency` when the declaring package uses it internally as a pure-function library, or when only plain interfaces and functions cross the boundary: there a duplicate costs bytes, not correctness, and it dedupes on its own.[^kit-peers]

Under that criterion six kit packages carry identity and are peers:

- `@effected/workspaces` — `WorkspaceSnapshots`, `WorkspaceDiscovery`, `PublishabilityDetector`, and `PublishTarget` appear in silk-effects' service layer requirements and results; silk-core's `SilkPublishConfig` extends its `PublishConfig` class and `AnalyzedWorkspace` carries its value classes. Peered by both silk-core and silk-effects.[^kit-peers][^core-peers]
- `@effected/git` — `Git` appears in silk-effects' service layer requirements. Peered by silk-effects.[^kit-peers]
- `@effected/commands` — `ToolDiscovery` is required by `TurboInspector`. Peered by silk-effects.[^kit-peers]
- `@effected/templates` — it exports `Section`, `CommentStyle`, and `SectionId` as nominal classes (`declare class X extends X_base`), and silk-core's exported `SavvySections`, `SavvyOkfSection`, and `SavvyInstallSection` schemas build on them, so they cross silk-core's public API boundary; silk-effects re-exports silk-core and imports templates itself, so it forwards the peer. Peered by both silk-core and silk-effects.[^core-sections][^core-peers][^kit-peers]

- `@effected/changesets` — `ReleasePlannerShape.plan` returns its `ReleasePlan` class, and the `Changesets` changelog types are its `ChangelogFunctions`, `ModCompWithPackage`, and `PlannedRelease`. Peered by silk-effects.[^kit-peers]
- `@effected/github` — `GitHubService.layer` requires its `ChangelogInfo` service. Peered by silk-effects.[^kit-peers][^github-service]

The last two were briefly declared regular `dependencies` by an owner exception while silk-effects' changesets engine was ported onto the kit. The owner (Spencer) reversed that ruling on 2026-11-09. The silk GitHub Actions import these kit packages directly and pass their values into silk-effects, and those values are Schema classes, so a second copy fails `instanceof` and decode at runtime. On `0.x` a caret pins the minor, so an action on a newer kit minor than silk-effects would get exactly that second copy. As peers, the consumer picks the version and silk-effects accepts it, so an action can upgrade the kit without waiting for a silk-effects release. `cli`, `mcp`, `silk`, and `@savvy-web/changelog` declare both as regular `dependencies` (`catalog:effected:exact`) to satisfy the peers.[^kit-peers][^cli-deps][^mcp-deps][^silk-deps][^changelog-deps]

The remaining kit packages silk-effects uses (`files`, `github-references`, `glob`, `jsonc`, `markdown`, `markdown-lint`, `package-json`, `toml`, `walker`, `yaml`) stay regular `dependencies`, written `catalog:effected:exact` because they resolve privately inside the sealed tool closure (see [tool-closure-exact-pins](tool-closure-exact-pins.md)). `@effected/github-references` stays a dependency in silk-core as well: `parseBareLines` returns a plain `interface BareLineReference`, not a class, so nothing nominal crosses.[^kit-peers][^core-peers]

Both manifests list their peers — the kit packages and `effect` alike — under `peerDependencies` as `catalog:effected:peers`, and the same packages under `devDependencies` as `catalog:effected` so each package still builds and tests standalone; the tool packages (`cli`, `mcp`, `silk`, `changelog`) declare the kit packages they import, and every kit peer their dependencies need, as `catalog:effected:exact` dependencies. The catalogs come from the `@effected/pnpm-plugin-effected` config dependency (`0.20.0` replaced `@effected/pnpm-plugin-effect` `0.19.0` under effected#1146; `0.26.2` is pinned now). Its install hook folds `effect`, every `@effect/*` package and every `@effected/*` kit library into the `effected` catalog, and since `0.26.0` it serves four catalogs to consumers: `effected`, `effected:peers`, `effected:build` and `effected:build:peers`; `0.26.2` adds `effected:exact`, the `effected` catalog with every operator stripped, which the tool closure's regular dependencies use. Consumers spell them as `catalog:` specifiers, never a literal version. This repo therefore tracks one number, the plugin pin in `pnpm-workspace.yaml`, and bumping it re-resolves every `catalog:` specifier at once. The old `catalog:effect` and `catalog:effect:peers` names no longer exist, and a manifest spelling one fails the install with `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC`. The plugin also pins every Effect family member graph-wide with overrides of its own (`effect@^4.0.0: 4.1.3` at `0.26.0`), so those pins are never hand-written here. Those overrides do not reach a `catalog:` dependency, though: pnpm 12.18 never applies a version-selector override to a `catalog:` spec (pnpm/pnpm#17922). Since `0.26.0` the served `effected` catalog therefore names every pinned family member at its exact override version (`effect: 4.1.3`), so a `catalog:effected` dependency and the override cannot disagree. That exactness is why a peer must be spelled through a peers catalog: a peer spelled `catalog:effected` would publish an exact `4.1.3`.[^kit-peers][^core-peers][^workspace]

The built `dist/prod/npm` manifests publish the peers catalog's range as the peer range: `effect: ~4.1.0` and each kit peer at a minor-floor caret (`@effected/changesets: ^0.4.0`, `@effected/workspaces: ^0.45.0` at `0.26.0`), not a floored `^4.0.0` and not the install catalog's exact or patch-floor value. Through `0.25.x` the plugin hid `effected:peers` from consumers, so peers were spelled `catalog:effected` and published as tight as the install range; `0.26.0` serves it, and the peer ranges loosened to the minor floor — see the consequences below.[^kit-peers]

Required peers convert what was silent duplication into a visible mismatch: on `0.x`, caret ranges are disjoint across minors, so a consumer on the wrong minor cannot satisfy the peer with the copy it already has. Where this stops is typecheck, not install — this repo sets `autoInstallPeers: true` and nothing sets `strictPeerDependencies` (pnpm's default is `false`), so a conflicting peer range prints a warning and the install exits 0; what actually fails is `tsc`, since two resolved copies of an identity-carrying package are two distinct type identities and a `Layer` built from one does not satisfy a requirement expressed by the other.[^kit-peers]

## Alternatives rejected

- **Bundle the kit into silk-effects.** Rejected: every consumer would get a private copy whose services could never be shared with the consumer's own kit usage, defeating the purpose of a peer relationship entirely.
- **Exact-pin the kit peers instead of ranging them.** Rejected: an exact peer would force every library consumer of silk-effects, the silk Actions above all, onto silk-effects' exact kit versions or a duplicate copy, and every kit release would force a silk-effects release before any consumer could move. silk-effects' regular kit dependencies are exact, but only because they resolve privately inside the tool closure ([tool-closure-exact-pins](tool-closure-exact-pins.md)).
- **Peer the whole kit, not just the identity-carrying packages.** Rejected on consumer-burden grounds: peering the whole kit would oblige `cli`, `mcp`, and `silk` to declare packages they do not import — `silk` would gain a dependency per package purely to satisfy transitive peers. The original three were already declared by both `cli` and `mcp`, and `templates` was already declared by `cli` and `silk`, so peering them cost nothing at the consumer; widening later is cheap, narrowing after every manifest moves is not.[^kit-peers]
- **Make a peer mismatch an install-time failure via `strictPeerDependencies: true`.** Not pursued: distributing that setting through `@savvy-web/pnpm-plugin-silk` would be a behavior change for every consuming repo, not just this one, and has not been made.[^kit-peers]

## Consequences

- Published peer ranges are the peers catalog's ranges: a tilde on the Effect minor (`~4.1.0`) and a minor-floor caret per kit peer. A consumer on a different Effect minor, or on an older kit minor, gets a peer warning; a consumer one patch behind no longer does. The Effect-minor constraint is real — the plugin holds the family to one minor graph-wide — and it is accepted because a hand-written peer range would reintroduce the per-version bookkeeping the catalog exists to remove.[^kit-peers]
- **The two-copies failure has a second route, through the catalog.** Because pnpm 12.18 never applies a version-selector override to a `catalog:` dependency (pnpm/pnpm#17922), a catalog range that admits more than the override pins can resolve a different version from the rest of the graph. Before `0.26.0` the `effected` catalog said `effect: ~4.1.2`; a fresh `effect` 4.1.3, which the kit exempts from `minimumReleaseAge`, resolved for the `catalog:` dependencies while the override held everything else, and the graph split into two `effect` copies. The `0.26.0` exact catalog closes that route; a plugin release that loosened the `effected` catalog's family entries again would reopen it.[^kit-peers][^workspace]
- A kit-library release without its paired `@effected/pnpm-plugin-effected` catalog release is invisible to catalog consumers, since a caret on `0.x` pins the minor inside the catalog too; coordinating a dogfood round means confirming the cut includes the plugin.[^kit-peers]
- The plugin pin bump in `pnpm-workspace.yaml`'s `configDependencies` is version **and** integrity hash together — editing the version and leaving the old `+sha512-…` hash will not install.[^kit-peers]
- **The trap**, tracked as savvy-web/systems#536: a `configDependencies` version bump alone does not make pnpm re-resolve it. pnpm reports "Lockfile is up to date, resolution step is skipped," silently keeps the previously linked version, and the new catalog appears not to exist (`ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC` for a catalog that does exist upstream). Removing `node_modules/.pnpm-config`, removing `node_modules/.pnpm-workspace-state-v1.json`, and `pnpm install --force` do not fix it. `pnpm-lock.yaml` is multi-document YAML whose **first** document pins the config dependency independently of the manifest; the fix is to hand-edit that first document's `specifier`, `version`, `packages:`, `integrity`, and `snapshots:` records, scoped to that document only, then install.[^kit-peers]
- Bumping a consumer's direct silk-effects pin across a major does not by itself collapse a duplicate if a lockfile-held intermediate still satisfies its own declared range; the operation is bump the direct pin, then explicitly update every intermediate that pins the old copy, verified by counting resolved versions in the lockfile after each step.[^kit-peers]
- A peer declared by silk-core is also declared by silk-effects: silk-effects re-exports silk-core, so any class identity silk-core exposes is exposed one layer up too. Adding a kit class to a silk-core public schema means adding the peer to both manifests.[^core-peers]
- `pnpm-workspace.yaml` sets `resolvePeersFromWorkspaceRoot: false` (added with the move to `effect` 4.0.0 and the predecessor plugin `@effected/pnpm-plugin-effect` 0.13.0). With pnpm's default, a workspace package's unsatisfied peer resolves from the root's dependencies, so a tool installed at the root that still carries a release-candidate copy of `effect` or a kit library could satisfy the new kit's peers with the wrong copy. With it off, a package's peers resolve only within its own dependency graph, so a kit package's required peers must be declared where it is used — the reason `@savvy-web/cli` declares `@effected/env`, `@effected/glob` and `@effected/walker`, required peers of `@effected/cli-kit` (then `@effected/cli`) 0.11.[^workspace]
- silk-effects' built public `.d.ts` also imports `@effected/markdown` (`Table`), `@effected/walker` (`GlobExpansionError`), and `@effected/yaml` (`YamlFormattingOptions`). By owner ruling, all three stay regular `dependencies`, because none carries an identity that breaks across two copies. `YamlFormattingOptions` is a plain options type. `GlobExpansionError` is matched by its `_tag`, not by `instanceof`. `Table` would matter only if an action built one and passed it into silk-effects; if that happens, revisit the ruling for `@effected/markdown`.[^kit-peers]
- Each kit peer publishes as a minor-floor caret from `catalog:effected:peers`, and on `0.x` a caret pins the minor. So when the kit takes a new minor, silk-effects needs a release before an action can move to it. The owner accepts this for now.[^kit-peers]
- A kit package with zero imports under `src/` is a dependency only when it satisfies a peer of something the package does import. `@effected/toml` is declared by silk-effects on that basis alone: nothing under its `src/` imports it, but it is an optional peer of `@effected/markdown`, whose TOML front-matter module the changesets engine loads.[^kit-peers]

[^kit-peers]: `../../packages/silk-effects/package.json`
[^core-peers]: `../../packages/silk-core/package.json`
[^core-sections]: `../../packages/silk-core/src/schemas`
[^workspace]: `../../pnpm-workspace.yaml`
[^changelog-deps]: `../../packages/changelog/package.json`
[^github-service]: `../../packages/silk-effects/src/changesets/services/github.ts`
[^cli-deps]: `../../packages/cli/package.json`
[^mcp-deps]: `../../packages/mcp/package.json`
[^silk-deps]: `../../packages/silk/package.json`
