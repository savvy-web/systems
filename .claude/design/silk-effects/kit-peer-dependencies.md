---
status: current
module: silk-effects
category: architecture
created: 2026-08-22
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ../pnpm-plugin-silk/architecture.md
dependencies:
  - ../pnpm-plugin-silk/architecture.md
---

# Kit peer dependencies and the `effected` catalog

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The problem it solves](#the-problem-it-solves)
- [What is peered, and what is not](#what-is-peered-and-what-is-not)
- [How the ranges are supplied](#how-the-ranges-are-supplied)
- [Deduplicating a consumer tree](#deduplicating-a-consumer-tree)
- [Trap: bumping the config dependency](#trap-bumping-the-config-dependency)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`@savvy-web/silk-effects` declares three `@effected/*` packages as required peers, supplied through the `effected:peers` catalog that the kit's own pnpm plugin publishes. This doc records why those three, how the ranges flow and the two operational traps that cost time when this landed.

## Current state

Live. `packages/silk-effects/package.json` lists `@effected/commands`, `@effected/git` and `@effected/workspaces` under `peerDependencies` as `catalog:effected:peers` (and under `devDependencies` as `catalog:effected` so the package still builds and tests); `cli` and `mcp` declare the same three as `catalog:effected` dependencies. The plugin pin lives in `pnpm-workspace.yaml`'s `configDependencies`. Verify the resolved state by counting versions in `pnpm-lock.yaml`, not by reading manifests.

## The problem it solves

silk-effects is consumed both directly by the GitHub Actions and transitively through `@savvy-web/silk` → `cli`/`mcp`. When a consumer's direct silk-effects pin drifts from the transitive one, the tree carries two silk-effects — and as regular `dependencies`, each drags its own copy of the kit. Observed in `silk-release-action`'s lockfile: two silk-effects majors, two `@effected/workspaces`, both bundled into the action artifact by rsbuild. Nothing failed; the artifact was simply twice as large. The other kit packages deduped only because the two silk-effects versions happened to pin overlapping ranges — luck, not design.

Required peers convert that silent duplication into a visible mismatch. On `0.x`, caret ranges are disjoint across minors, so a consumer on the wrong minor cannot satisfy the peer with the copy it already has.

**Where that stops is typecheck, not install.** This repo sets `autoInstallPeers: true` and nothing — here or in `@savvy-web/pnpm-plugin-silk` — sets `strictPeerDependencies`, whose pnpm default is `false`. A conflicting peer range prints a warning and the install exits 0. What fails is `tsc`: two resolved copies are two distinct type identities, so a `Layer` built from one does not satisfy a requirement expressed by the other (`Layer<... WorkspaceSnapshots> is not assignable to Layer<McpServices, …>` was the first sighting, in `mcp`). A consuming repo whose CI bundles without typechecking will not catch the skew. Making it an install-time failure would mean distributing `strictPeerDependencies: true` through `packages/pnpm-plugin-silk/savvy.build.ts` — a behavior change for every consuming repo that has not been made.

## What is peered, and what is not

Only the **identity-carrying** packages — those whose services and types cross silk-effects' public API boundary, so two copies mean two type identities:

| Package | Why peered |
| --- | --- |
| `@effected/workspaces` | `WorkspaceSnapshots`, `WorkspaceDiscovery`, `PublishabilityDetector` and `PublishTarget` appear in service layer requirements and results |
| `@effected/git` | `Git` appears in service layer requirements |
| `@effected/commands` | `ToolDiscovery` is required by `TurboInspector` |

The remaining kit packages in `dependencies` (`github-references`, `glob`, `jsonc`, `markdown`, `package-json`, `templates`, `walker`, `yaml`) are pure functions where a duplicate costs bytes, not correctness, and they dedupe on their own.

**The deciding evidence was consumer burden.** Peering the whole kit would oblige `cli`, `mcp` and `silk` to declare packages they do not import — `silk` would gain a dependency per package purely to satisfy transitive peers. The three chosen were already declared by both `cli` and `mcp`, so peering them cost nothing at the consumer, and both action repos already declared exactly these three. Widening later is cheap; narrowing after every manifest moves is not.

## How the ranges are supplied

```text
silk-effects  peerDependencies → catalog:effected:peers
              devDependencies  → catalog:effected
cli, mcp      dependencies     → catalog:effected
```

Both catalogs come from the `@effected/pnpm-plugin-effect` config dependency, which the kit publishes itself with an entry per kit library. Consumers spell kit dependencies `catalog:effected`, never a version, so this repo tracks one number — the plugin pin in `pnpm-workspace.yaml` — and bumping it re-resolves every `catalog:effected` specifier at once. `catalog:` resolves inside `peerDependencies`; `effect: catalog:effect:peers` has done the same here for a long time.

Three consequences:

- **A kit-library release without the paired plugin release is invisible** to catalog consumers — a caret on `0.x` pins the minor inside the catalog too. Upstream pairs a library bump with the plugin's catalog bump in one cut; when coordinating a dogfood round, confirm the cut includes the plugin.
- **The pin bump is version+integrity, not version alone.** The `configDependencies` entry carries a `+sha512-…` hash; editing the version and leaving the old hash will not install. Get the hash from `npm view @effected/pnpm-plugin-effect@<version> dist.integrity` — `pnpm add --config` omits it.
- **Dogfood exits skip the range-bump step.** This repo never owns the kit ranges, so the exit is: remove the `file:` override, bump the plugin pin (version+integrity), `pnpm clean --lockfile && pnpm install`, full gates. See the dogfooding section of the root `CLAUDE.md`.

## Deduplicating a consumer tree

Bumping a consumer's direct `@savvy-web/silk-effects` pin across the major does not by itself collapse a duplicate. A lockfile-held intermediate keeps satisfying its own declared range: if the repo declares `@savvy-web/silk@^x.y.0` and the lockfile holds `x.y.0`, a plain install never moves it, and that version pins the old silk-effects exactly. The operation is "bump the direct pin, then explicitly update every intermediate that pins the old copy (`pnpm update @savvy-web/silk`, then `pnpm update @effected/workspaces`)", verified by counting resolved versions in the lockfile after each step.

## Trap: bumping the config dependency

**A `configDependencies` version bump in `pnpm-workspace.yaml` does not make pnpm re-resolve it.** pnpm reports `Lockfile is up to date, resolution step is skipped`, silently keeps the previously linked version, and the new catalog appears not to exist — surfacing as `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC` for a catalog that does exist upstream. Removing `node_modules/.pnpm-config`, removing `node_modules/.pnpm-workspace-state-v1.json` (which does cache `configDependencies`, but clearing it is insufficient) and `pnpm install --force` do not fix it.

`pnpm-lock.yaml` is a multi-document YAML file whose **first** document pins the config dependency independently of the manifest. Hand-edit that record — `specifier`, `version`, the `packages:` key, its `integrity` and the `snapshots:` key — then install. Scope the edit to the first document; the second is the ordinary dependency lockfile. Tracked as savvy-web/systems#536.

The trap was first misdiagnosed as `minimumReleaseAge` blocking a fresh publish — a cause inferred from circumstantial evidence rather than measured. The discipline that would have caught it sooner: produce the condition a check claims to detect and watch the check fire, rather than reading the check and agreeing it looks right.

## Rationale

### Why peers rather than bundling or pinning

Bundling the kit into silk-effects would give every consumer a private copy whose services can never be shared with the consumer's own kit usage. Exact pins would make every kit release a silk-effects release. Peers on a catalog range let one plugin bump move both sides of every peer relationship atomically, and turn a skew into a type error instead of a silent duplicate.

### Why only three

The narrow set is exactly the set whose duplication is a correctness failure; everything else is a byte cost that dedupes naturally. Consumers already declared the three, so the change cost them nothing.

## Related documentation

- [Architecture overview](./architecture.md) — the dependency posture in context
- [`../pnpm-plugin-silk/architecture.md`](../pnpm-plugin-silk/architecture.md) — the `silk` catalogs and install-time policy this repo distributes to consumers
