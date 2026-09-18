---
type: Decision
title: Kit Effect peers supplied via the effected catalog
description: "silk-core and silk-effects declare only the identity-carrying @effected/* packages (commands, git, templates, workspaces) as required peers, spelled catalog:effected:peers, with ranges supplied by @effected/pnpm-plugin-effect's catalogs rather than hand-pinned versions."
status: draft
tags: [architecture, release, deps]
sources:
  - id: kit-peers
    resource: ../../packages/silk-effects/package.json
  - id: core-peers
    resource: ../../packages/silk-core/package.json
  - id: core-sections
    resource: ../../packages/silk-core/src/schemas
generated:
  by: okfit/claude-code
  at: 2026-09-18T12:53:56Z
  body_sha256: f61a7be50bf83bbfb079c68a0a308cf7d7808a366221c776f8ecc7ff03bd994f
---

# Kit Effect peers supplied via the effected catalog

## Context

[silk-effects](../modules/silk-effects.md) is consumed both directly by the GitHub Actions and transitively through `@savvy-web/silk` → cli/mcp. When a consumer's direct silk-effects pin drifted from the transitive one, the tree carried two silk-effects copies, and as regular `dependencies` each dragged its own copy of the `@effected/*` kit — observed in `silk-release-action`'s lockfile as two silk-effects majors and two `@effected/workspaces`, both bundled into the action artifact. The other kit packages deduped only because the two silk-effects versions happened to pin overlapping ranges — luck, not design.[^kit-peers]

The same question recurs one layer down: [silk-core](../modules/silk-core.md) (L1) exports schemas that extend kit classes, and silk-effects re-exports silk-core, so a kit class that reaches silk-core's public surface reaches every consumer above it.[^core-peers]

## Decision

The criterion is **nominal identity across the exported API**. A kit package is a required peer when a class or `Context.Service` it defines appears in the declaring package's public surface — as a schema base, a service requirement, or a result type — so that two resolved copies would be two distinct type identities. A kit package is a regular `dependency` when the declaring package uses it internally as a pure-function library, or when only plain interfaces and functions cross the boundary: there a duplicate costs bytes, not correctness, and it dedupes on its own.[^kit-peers]

Under that criterion four kit packages carry identity and are peers:

- `@effected/workspaces` — `WorkspaceSnapshots`, `WorkspaceDiscovery`, `PublishabilityDetector`, and `PublishTarget` appear in silk-effects' service layer requirements and results; silk-core's `SilkPublishConfig` extends its `PublishConfig` class and `AnalyzedWorkspace` carries its value classes. Peered by both silk-core and silk-effects.[^kit-peers][^core-peers]
- `@effected/git` — `Git` appears in silk-effects' service layer requirements. Peered by silk-effects.[^kit-peers]
- `@effected/commands` — `ToolDiscovery` is required by `TurboInspector`. Peered by silk-effects.[^kit-peers]
- `@effected/templates` — it exports `Section`, `CommentStyle`, and `SectionId` as nominal classes (`declare class X extends X_base`), and silk-core's exported `SavvySections`, `SavvyOkfSection`, and `SavvyInstallSection` schemas build on them, so they cross silk-core's public API boundary; silk-effects re-exports silk-core and imports templates itself, so it forwards the peer. Peered by both silk-core and silk-effects.[^core-sections][^core-peers][^kit-peers]

The remaining kit packages silk-effects uses (`github-references`, `glob`, `jsonc`, `markdown`, `package-json`, `walker`, `yaml`) stay regular `dependencies`. `@effected/github-references` stays a dependency in silk-core as well: `parseBareLines` returns a plain `interface BareLineReference`, not a class, so nothing nominal crosses.[^kit-peers][^core-peers]

Both manifests list their peers under `peerDependencies` as `catalog:effected:peers` (kit) and `catalog:effect:peers` (`effect`), and under `devDependencies` as `catalog:effected` / `catalog:effect` so each package still builds and tests standalone; `cli`, `mcp`, and `silk` declare the kit packages they import as `catalog:effected` dependencies, and the built `dist/prod/npm` manifests publish the `:peers` ranges. All four catalogs come from the `@effected/pnpm-plugin-effect` config dependency, which the kit publishes itself with one catalog entry per kit library — consumers spell kit dependencies `catalog:effected`, never a literal version, so this repo tracks one number (the plugin pin in `pnpm-workspace.yaml`) and bumping it re-resolves every `catalog:` specifier at once. The `:peers` spelling is not cosmetic: the `effected` catalog carries patch-floor carets (`@effected/commands ^0.7.1`, `@effected/git ^0.15.1`) while `effected:peers` carries minor-floor carets (`^0.7.0`, `^0.15.0`), so a peer spelled `catalog:effected` would reject a consumer one patch behind for no identity reason. `effect` and `effect:peers` currently resolve to the same `4.0.0-rc.115`; the split is kept for the day they diverge.[^kit-peers][^core-peers]

Required peers convert what was silent duplication into a visible mismatch: on `0.x`, caret ranges are disjoint across minors, so a consumer on the wrong minor cannot satisfy the peer with the copy it already has. Where this stops is typecheck, not install — this repo sets `autoInstallPeers: true` and nothing sets `strictPeerDependencies` (pnpm's default is `false`), so a conflicting peer range prints a warning and the install exits 0; what actually fails is `tsc`, since two resolved copies of an identity-carrying package are two distinct type identities and a `Layer` built from one does not satisfy a requirement expressed by the other.[^kit-peers]

## Alternatives rejected

- **Bundle the kit into silk-effects.** Rejected: every consumer would get a private copy whose services could never be shared with the consumer's own kit usage, defeating the purpose of a peer relationship entirely.
- **Exact-pin the kit versions instead of peering.** Rejected: every kit release would then force a silk-effects release, coupling silk-effects' cadence to upstream libraries' cadence for no correctness benefit.
- **Peer the whole kit, not just the identity-carrying packages.** Rejected on consumer-burden grounds: peering the whole kit would oblige `cli`, `mcp`, and `silk` to declare packages they do not import — `silk` would gain a dependency per package purely to satisfy transitive peers. The original three were already declared by both `cli` and `mcp`, and `templates` was already declared by `cli` and `silk`, so peering them cost nothing at the consumer; widening later is cheap, narrowing after every manifest moves is not.[^kit-peers]
- **Make a peer mismatch an install-time failure via `strictPeerDependencies: true`.** Not pursued: distributing that setting through `@savvy-web/pnpm-plugin-silk` would be a behavior change for every consuming repo, not just this one, and has not been made.[^kit-peers]

## Consequences

- A kit-library release without its paired `@effected/pnpm-plugin-effect` catalog release is invisible to catalog consumers, since a caret on `0.x` pins the minor inside the catalog too; coordinating a dogfood round means confirming the cut includes the plugin.[^kit-peers]
- The plugin pin bump in `pnpm-workspace.yaml`'s `configDependencies` is version **and** integrity hash together — editing the version and leaving the old `+sha512-…` hash will not install.[^kit-peers]
- **The trap**, tracked as savvy-web/systems#536: a `configDependencies` version bump alone does not make pnpm re-resolve it. pnpm reports "Lockfile is up to date, resolution step is skipped," silently keeps the previously linked version, and the new catalog appears not to exist (`ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC` for a catalog that does exist upstream). Removing `node_modules/.pnpm-config`, removing `node_modules/.pnpm-workspace-state-v1.json`, and `pnpm install --force` do not fix it. `pnpm-lock.yaml` is multi-document YAML whose **first** document pins the config dependency independently of the manifest; the fix is to hand-edit that first document's `specifier`, `version`, `packages:`, `integrity`, and `snapshots:` records, scoped to that document only, then install.[^kit-peers]
- Bumping a consumer's direct silk-effects pin across a major does not by itself collapse a duplicate if a lockfile-held intermediate still satisfies its own declared range; the operation is bump the direct pin, then explicitly update every intermediate that pins the old copy, verified by counting resolved versions in the lockfile after each step.[^kit-peers]
- A peer declared by silk-core is also declared by silk-effects: silk-effects re-exports silk-core, so any class identity silk-core exposes is exposed one layer up too. Adding a kit class to a silk-core public schema means adding the peer to both manifests.[^core-peers]
- A kit package with zero imports under `src/` is not a dependency of any kind — `@effected/toml` was removed from silk-effects on this basis.[^kit-peers]

[^kit-peers]: `../../packages/silk-effects/package.json`
[^core-peers]: `../../packages/silk-core/package.json`
[^core-sections]: `../../packages/silk-core/src/schemas`
