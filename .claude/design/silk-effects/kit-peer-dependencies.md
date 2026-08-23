---
status: current
module: silk-effects
category: architecture
created: 2026-08-22
updated: 2026-08-23
last-synced: 2026-08-23
completeness: 90
related:
  - ./architecture.md
  - ../pnpm-plugin-silk/architecture.md
dependencies:
  - ../pnpm-plugin-silk/architecture.md
---

# Kit peer dependencies and the `effected` catalog

Why `@savvy-web/silk-effects` declares three `@effected/*` packages as required peers, how those ranges are
supplied, and the traps that cost time when this landed.

## The problem it solves

silk-effects is consumed both directly by the GitHub Actions and transitively through `@savvy-web/silk` →
`cli`/`mcp`. When a consumer's direct silk-effects pin drifts from the transitive one, the tree carries two
silk-effects — and as regular `dependencies`, each drags its own copy of the kit. Observed in
`silk-release-action`'s lockfile before this change:

```text
@savvy-web/silk-effects@5.9.3 → @effected/workspaces 0.14.2
@savvy-web/silk-effects@6.0.5 → @effected/workspaces 0.17.0
```

Both copies were bundled into the action artifact by rsbuild. Nothing failed; the build was green and the artifact
was simply twice as large and carried two of everything. The other kit packages deduped only because the two
silk-effects versions happened to pin overlapping ranges — luck, not design.

Required peers convert that silent duplication into a visible mismatch. On `0.x`, caret ranges are disjoint across
minors, so a consumer on the wrong minor cannot satisfy the peer with the copy it already has.

**Where that actually stops is typecheck, not install.** This repo sets `autoInstallPeers: true` and nothing —
here or in `@savvy-web/pnpm-plugin-silk` — sets `strictPeerDependencies`, whose pnpm default is `false`. A
conflicting peer range therefore prints a warning and the install exits 0. What fails is `tsc`: two resolved
copies are two distinct type identities, so a `Layer` built from one does not satisfy a requirement expressed by
the other. A consuming repo whose CI bundles without typechecking will not catch the skew.

Making it an install-time failure means distributing `strictPeerDependencies: true` through
`packages/pnpm-plugin-silk/savvy.build.ts`. That is a behavior change for every consuming repo and has not been
done.

## What is peered, and what is not

Only the three **identity-carrying** packages — those whose services and types cross silk-effects' public API
boundary, so two copies mean two distinct type identities:

| Package | Why peered |
| --- | --- |
| `@effected/workspaces` | `WorkspaceSnapshots` appears in `DepsRegen.layer`'s requirements |
| `@effected/git` | `Git` appears in service layer requirements |
| `@effected/commands` | `ToolDiscovery` is required by `TurboInspector` |

The remaining seven (`github-references`, `glob`, `jsonc`, `package-json`, `templates`, `walker`, `yaml`) stay
regular `dependencies`. They are pure functions where a duplicate costs bytes, not correctness, and they deduped
on their own.

**The deciding evidence was consumer burden.** Peering all ten would oblige `cli`, `mcp` and `silk` to declare
packages they do not import — `silk` would gain nine dependencies purely to satisfy transitive peers. The three
chosen are already declared by both `cli` and `mcp`, so peering them cost nothing at the consumer. Widening later
is cheap; narrowing after eleven manifests move is not.

## How the ranges are supplied

```text
silk-effects  peerDependencies → catalog:effected:peers
              devDependencies  → catalog:effected      (so it still builds and tests)
cli, mcp      dependencies     → catalog:effected
```

Both catalogs come from the `@effected/pnpm-plugin-effect` config dependency (`0.6.0`+), which the kit publishes
itself — 29 entries, excluding the plugin. A single config-dependency bump moves both sides of every peer
relationship atomically, which is the whole reason for using a catalog rather than literals in eleven manifests
across the ecosystem.

`catalog:` resolves inside `peerDependencies`; this is long-established here (`effect: catalog:effect:peers`) and
independently confirmed by eleven manifests in the effected repo doing the same.

## The plugin is the kit's version surface

Formalized upstream in the 2026-08-23 dogfood round. `@effected/pnpm-plugin-effect` publishes the `effected`
and `effected:peers` catalogs carrying the current version of every kit library. Consumers spell kit
dependencies `catalog:effected`, never a version — so this repo tracks ONE number, the plugin pin in
`pnpm-workspace.yaml`'s `configDependencies:`, and bumping it re-resolves every `catalog:effected` specifier at
once.

Three consequences:

- **A kit-library release without the paired plugin release is invisible** to catalog consumers — a caret on
  `0.x` pins the minor inside the catalog too. Upstream's release discipline now pairs a library bump with the
  plugin's catalog bump in one cut (via pending-changeset-aware `catalog:sync`); when coordinating a dogfood
  round, confirm the cut includes the plugin.
- **The pin bump is version+integrity, not version alone.** The `configDependencies` entry carries a
  `+sha512-...` integrity hash; editing the version and leaving the old hash will not install. Obtain the hash
  from the registry — `npm view @effected/pnpm-plugin-effect@<version> dist.integrity` — and the pin becomes
  `<version>+<that value>`. (Verified: the current `0.6.3` pin's hash matches exactly what that command
  returns.)
- **Dogfood exits skip the range-bump step.** The protocol's "bump declared ranges while linked" step does not
  apply to catalog-supplied kit ranges — this repo never owns them. The exit equivalent is: remove the `file:`
  override, bump the plugin pin (version+integrity), `pnpm clean --lockfile && pnpm install` (scripts ON), full
  gates.

## The mechanism proved itself immediately

When the peers landed with silk-effects on the catalog (`^0.17.1`) but `cli`/`mcp` still on literal `^0.17.0`, the
tree carried two `@effected/workspaces` and `tsc` failed in `mcp`:

```text
Layer<... WorkspaceSnapshots> is not assignable to Layer<McpServices, never, ...>
```

Two copies, two type identities, one unsatisfiable `Layer`. That is exactly the duplication described above,
surfacing **loudly at typecheck** rather than silently in a bundle. Aligning `cli` and `mcp` to the same catalog
fixed it. Before the peer change the same skew installed clean and shipped two copies.

## Known residual

`rolldown-pnpm-config@0.7.0` depends on `@effected/workspaces@^0.17.0` and retains a `0.17.0` resolution while our
packages take `0.17.1`. It is a build-time devDependency bundled into nothing shipped — bytes, not correctness,
which is the line the narrow-three decision drew. `pnpm dedupe` would collapse it if it ever matters.

## The dedup is not one manifest edit

Bumping a consumer's direct `@savvy-web/silk-effects` pin across the major does NOT by itself collapse the
duplicate. Measured in `silk-release-action`, which is the tree this design was written from:

| Step | silk-effects | @effected/workspaces |
| --- | --- | --- |
| Before | 5.9.3 + 6.0.5 | 0.14.2 + 0.17.0 |
| After bumping the direct pin to `^7.0.0` | 6.0.5 + 7.0.0 | 0.17.1 |
| After `pnpm update @savvy-web/silk` (3.9.0 → 3.9.1) | 7.0.0 | 0.17.0 + 0.17.1 |
| After `pnpm update @effected/workspaces` | 7.0.0 | 0.17.1 |

The reason is that a lockfile-held intermediate keeps satisfying its own declared range. The repo declared
`@savvy-web/silk@^3.9.0` and the lockfile held `3.9.0`; the range was satisfied, so a plain install never moved
it, and `3.9.0` pins `silk-effects@6.0.5` exactly. Each intermediate has to be updated explicitly before the copy
it pins is released.

So the design's two-to-one prediction holds, but the operation is "bump the direct pin, then update every
intermediate that pins the old copy" — not a single manifest edit. Verify by counting resolved versions in the
lockfile, not by reading manifests.

The peer ranges needed no change at any point: both action repos already declared `@effected/commands ^0.5.0`,
`@effected/git ^0.9.0` and `@effected/workspaces ^0.17.0`, which is exactly what silk-effects@7 requires. That is
the narrow-three decision paying off — those three were chosen because consumers already declared them.

## Trap: bumping the config dependency

**A `configDependencies` version bump in `pnpm-workspace.yaml` does not make pnpm re-resolve it.** pnpm reports
`Lockfile is up to date, resolution step is skipped`, silently keeps the previously-linked version, and the new
catalog appears not to exist — surfacing as `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC` for a catalog that does
exist upstream.

None of these fix it: removing `node_modules/.pnpm-config`, removing `node_modules/.pnpm-workspace-state-v1.json`
(which *does* cache `configDependencies`, but clearing it is insufficient), or `pnpm install --force`.

`pnpm-lock.yaml` is a multi-document YAML file whose **first** document pins the config dependency independently of
the manifest. Hand-edit that record — `specifier`, `version`, the `packages:` key, its `integrity`, and the
`snapshots:` key — then install. Scope the edit to the first document; the second is the ordinary dependency
lockfile.

Tracked as savvy-web/systems#536. Note the integrity hash comes from `npm view <pkg>@<version> dist.integrity`,
and that `pnpm add --config` omits it.

This trap was first misdiagnosed as `minimumReleaseAge` blocking a fresh publish: the store held no new version, so
a blocked fetch looked likely, when pnpm had simply never attempted one. A cause inferred from circumstantial
evidence rather than established — see below.

## Engineering note: checks that fail open

The programme that produced this change surfaced six defects sharing one shape — each reported success while doing
nothing, and each was found by **measuring** rather than reading:

1. A turbo cache check written with `touch`, which cannot fail: turbo hashes content, not mtimes.
2. A `git diff --quiet` change check blind to untracked files, so the first run — the one with a new changeset to
   propose — reported "no changes".
3. A validation gate inheriting a stderr substring grep, so a checker printing "0 errors found" and exiting 0 would
   have failed every release.
4. Four tests that never ran: `it(() => Effect.gen(...))` returns an un-run Effect, so no assertion reaches the
   runner. Proven by adding an assertion that throws on `undefined` while the property did not exist — the test
   still passed.
5. A non-interactive upgrade path that selected nothing and exited 0, because the only candidate was out of the
   declared range by design.
6. A preview mode that disagreed with the action it previewed, so the projection a human inspected described a
   different operation than the one that would run.

A seventh had the polarity reversed — a permission-diff grep that matched prose and fired on documentation while
the permission block was byte-identical. Same root cause, opposite symptom: the check did not measure what it
claimed.

A seventh, met three times in this programme and twice more in the protocol's own history: **an artifact search
that finds nothing because the search is broken, reported as "the fix is missing."** Fetching a 2.3MB bundle
through an API that inlines file content yields nothing greppable, and every marker comes back absent — which
reads exactly like a stale artifact. The discipline that catches it is a control symbol: grep for something known
to be present, and if the control does not light up, distrust the search rather than the artifact. Here the
control was absent from two bundles at once, which is impossible, and that impossibility was the tell.

An eighth, and the most instructive because it happened while hunting the family itself. A session set out to
disprove a claim that the release gate had rejected a bad release, queried `/commits/{sha}/check-runs` on three
branch heads, found zero non-success results, and reported that the gate had never failed. Both halves of the
search were blind:

- **Wrong location.** PR validation posts check runs to the pull request's MERGE ref, not the head. The failing
  `Build Validation` check — conclusion `failure`, title "The on-build gate failed" — was on a merge commit that
  was never queried. "Zero non-success on the heads" was a true statement about a place the answer does not live.
- **Wrong layer.** Filtering on workflow run and job conclusions cannot see a gate failure at all. The job
  concluded `success` while containing the failed gate, because the step's error channel is `never` and it
  signals through `success: false` into the check derivation. Conclusions are structurally blind to the event.

No positive control was run. Asking "does this query return a failing check I already know exists?" would have
exposed the scope error immediately.

**An accident is not a control.** The gate's failure that day was incidental — real drift, caught for real, but
nobody made it happen. That proves the mechanism *can* fire; it does not prove anyone can make it fire on demand,
and only the second is a control. A deliberate exercise — hand-stale a catalog range, open a PR, watch validation
go red on purpose — remains the outstanding verification.

**Review is not the control.** All of these were in reviewed code. Reviewing a check means reading it and agreeing
it looks correct, and all of them did. What caught them was producing the condition the check claims to catch and
watching it fail to catch it. A check whose failing case has never been exercised is an untested assertion about
the system, however many people have read it.

Corollary for previews: any `--preview`, `--dry-run` or `--check` mode is a second implementation of the thing it
previews, and drifts from it silently unless something pins the two together.

## Sequencing note

The peers work is independent of the upstream catalog automation. It can ship with literal ranges and migrate to
the catalog afterwards — the ranges are identical either way (`commands ^0.5.0`, `git ^0.9.0`,
`workspaces ^0.17.0`, the last `lock-minor`-floored from the catalog's `^0.17.1`).
