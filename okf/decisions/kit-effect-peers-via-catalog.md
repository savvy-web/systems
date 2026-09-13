---
type: Decision
title: Kit Effect peers supplied via the effected catalog
description: "silk-effects declares only the three identity-carrying @effected/* packages (commands, git, workspaces) as required peers, with ranges supplied by @effected/pnpm-plugin-effect's effected:peers catalog rather than hand-pinned versions."
status: draft
tags: [architecture, release]
sources:
  - id: kit-peers
    resource: ../../packages/silk-effects/package.json
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: c0d21fb898664fedaebabc1f1c81ecfb49684d40f7845d03df2431a6b99fc7e3
---

# Kit Effect peers supplied via the effected catalog

## Context

[silk-effects](../modules/silk-effects.md) is consumed both directly by the GitHub Actions and transitively through `@savvy-web/silk` → cli/mcp. When a consumer's direct silk-effects pin drifted from the transitive one, the tree carried two silk-effects copies, and as regular `dependencies` each dragged its own copy of the `@effected/*` kit — observed in `silk-release-action`'s lockfile as two silk-effects majors and two `@effected/workspaces`, both bundled into the action artifact. The other kit packages deduped only because the two silk-effects versions happened to pin overlapping ranges — luck, not design.[^kit-peers]

## Decision

Only the **identity-carrying** kit packages — those whose services and types cross silk-effects' public API boundary, so two resolved copies mean two distinct type identities — are declared as required peers: `@effected/workspaces` (`WorkspaceSnapshots`, `WorkspaceDiscovery`, `PublishabilityDetector`, `PublishTarget` appear in service layer requirements and results), `@effected/git` (`Git` appears in service layer requirements), and `@effected/commands` (`ToolDiscovery` is required by `TurboInspector`). The remaining kit packages (`github-references`, `glob`, `jsonc`, `markdown`, `package-json`, `templates`, `walker`, `yaml`) stay regular `dependencies`: they are pure functions where a duplicate costs bytes, not correctness, and they dedupe on their own.[^kit-peers]

`packages/silk-effects/package.json` lists the three under `peerDependencies` as `catalog:effected:peers` and under `devDependencies` as `catalog:effected` (so the package still builds and tests standalone); `cli` and `mcp` declare the same three as `catalog:effected` dependencies. Both catalogs come from the `@effected/pnpm-plugin-effect` config dependency, which the kit publishes itself with one catalog entry per kit library — consumers spell kit dependencies `catalog:effected`, never a literal version, so this repo tracks one number (the plugin pin in `pnpm-workspace.yaml`) and bumping it re-resolves every `catalog:effected` specifier at once.[^kit-peers]

Required peers convert what was silent duplication into a visible mismatch: on `0.x`, caret ranges are disjoint across minors, so a consumer on the wrong minor cannot satisfy the peer with the copy it already has. Where this stops is typecheck, not install — this repo sets `autoInstallPeers: true` and nothing sets `strictPeerDependencies` (pnpm's default is `false`), so a conflicting peer range prints a warning and the install exits 0; what actually fails is `tsc`, since two resolved copies of an identity-carrying package are two distinct type identities and a `Layer` built from one does not satisfy a requirement expressed by the other.[^kit-peers]

## Alternatives rejected

- **Bundle the kit into silk-effects.** Rejected: every consumer would get a private copy whose services could never be shared with the consumer's own kit usage, defeating the purpose of a peer relationship entirely.
- **Exact-pin the kit versions instead of peering.** Rejected: every kit release would then force a silk-effects release, coupling silk-effects' cadence to three upstream libraries' cadence for no correctness benefit.
- **Peer the whole kit, not just the three identity-carrying packages.** Rejected on consumer-burden grounds: peering the whole kit would oblige `cli`, `mcp`, and `silk` to declare packages they do not import — `silk` would gain a dependency per package purely to satisfy transitive peers. The three chosen were already declared by both `cli` and `mcp`, so peering them cost nothing at the consumer; widening later is cheap, narrowing after every manifest moves is not.[^kit-peers]
- **Make a peer mismatch an install-time failure via `strictPeerDependencies: true`.** Not pursued: distributing that setting through `@savvy-web/pnpm-plugin-silk` would be a behavior change for every consuming repo, not just this one, and has not been made.[^kit-peers]

## Consequences

- A kit-library release without its paired `@effected/pnpm-plugin-effect` catalog release is invisible to catalog consumers, since a caret on `0.x` pins the minor inside the catalog too; coordinating a dogfood round means confirming the cut includes the plugin.[^kit-peers]
- The plugin pin bump in `pnpm-workspace.yaml`'s `configDependencies` is version **and** integrity hash together — editing the version and leaving the old `+sha512-…` hash will not install.[^kit-peers]
- **The trap**, tracked as savvy-web/systems#536: a `configDependencies` version bump alone does not make pnpm re-resolve it. pnpm reports "Lockfile is up to date, resolution step is skipped," silently keeps the previously linked version, and the new catalog appears not to exist (`ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC` for a catalog that does exist upstream). Removing `node_modules/.pnpm-config`, removing `node_modules/.pnpm-workspace-state-v1.json`, and `pnpm install --force` do not fix it. `pnpm-lock.yaml` is multi-document YAML whose **first** document pins the config dependency independently of the manifest; the fix is to hand-edit that first document's `specifier`, `version`, `packages:`, `integrity`, and `snapshots:` records, scoped to that document only, then install.[^kit-peers]
- Bumping a consumer's direct silk-effects pin across a major does not by itself collapse a duplicate if a lockfile-held intermediate still satisfies its own declared range; the operation is bump the direct pin, then explicitly update every intermediate that pins the old copy, verified by counting resolved versions in the lockfile after each step.[^kit-peers]
- silk-core also peers `@effected/workspaces`, for class identity, alongside silk-effects.

[^kit-peers]: `../../packages/silk-effects/package.json`
