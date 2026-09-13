---
type: Decision
title: Split the build orchestrator from the plugin pack
description: "@savvy-web/bundler and @savvy-web/tsdown-plugins are two packages, split on an interface boundary, rather than one build-tool package."
status: draft
tags: [build, architecture]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 9ff26b2dcb05b3b42863331b65b741aa04f65dd566c43e08d035b9c2944f1da5
sources:
  - id: bundler-arch
    resource: ../../packages/bundler/package.json
  - id: tp-arch
    resource: ../../packages/tsdown-plugins/package.json
---

# Split the build orchestrator from the plugin pack

## Context

Every Silk Suite TypeScript package builds through one bundler stack.
Two costs recur in a single-package build-tool design: a maintained peer
dependency on the underlying bundler (`tsdown`) drifts out of sync and
causes install firefights across an ecosystem of repos as `tsdown` (and
`typescript`) versions move, and a power user who wants to compose the
build behavior by hand has no path that isn't reverse-engineering private
orchestrator internals.

## Decision

Split the program into two packages on an interface boundary:

- **`@savvy-web/tsdown-plugins`** — the plugin pack. Every build behavior
  (entry detection, manifest emission, catalog resolution, the dts
  tsconfig port, the per-group build loop, the meta pass, the output
  reporter) lives here as composable helpers and rolldown plugins,
  authored against `import type { Plugin } from "rolldown"` only —
  interface-only coupling, no rolldown runtime import anywhere in `src`.
  `tsdown` is a declared runtime dependency (not a peer), touched at
  exactly two injectable seams
  (`buildTargetGroups`, `runExeBuild`).
- **`@savvy-web/bundler`** — the thin orchestrator. It depends on
  `tsdown-plugins`, `tsdown`, `rolldown` and `@tsdown/exe` as regular
  dependencies, reads a package's `package.json` and `savvy.build.ts`, and
  drives tsdown's programmatic `build()` once per TargetGroup. It owns no
  build logic beyond the `savvy.build.ts` contract, arg parsing and phase
  ordering.

See [modules/bundler.md](../modules/bundler.md) and
[modules/tsdown-plugins.md](../modules/tsdown-plugins.md).

## Alternatives rejected

- **One package, `tsdown`/`rolldown` as peers.** Rejected: an undeclared
  or peer `tsdown` resolves against whatever TypeScript major the
  consumer workspace pins, which broke declaration emit outright once
  that major was TypeScript 7 (see
  [decisions/typescript-6-dts-pin.md](typescript-6-dts-pin.md)); a peer on
  the bundler core is exactly the drift this design avoids — the
  predecessor toolchain carried a maintained `@rslib/core` peer that had
  to be firefought across the ecosystem on every upgrade.
  Depending on `tsdown` as a regular dependency of `tsdown-plugins` (and
  transitively of `bundler`) makes a `tsdown` upgrade a single
  bundler-adjacent release rather than an ecosystem-wide peer bump.
- **One package, no escape hatch.** Rejected: without an interface-only,
  independently importable plugin pack, the orchestrator's own front
  door would be the only entry point, and a power user with build needs
  the orchestrator doesn't cover would have no sanctioned path except
  forking or monkey-patching.
- **Effect as a peer dependency.** Rejected for the same poison-resolution
  reason as `tsdown`/`rolldown`: when Effect was a peer, a consumer on a
  different Effect major poisoned peer resolution at the consumer's
  importer level and crashed every `savvy.build.ts` with
  `ERR_MODULE_NOT_FOUND`. `effect` is a regular dependency of
  `tsdown-plugins` instead, with no `peerDependencies` block — on Effect
  v4 the whole peer closure is `effect` itself, so one dependency seals
  the graph. `@savvy-web/cli` and `@savvy-web/mcp` take the same posture.

## Consequences

- A common-path consumer installs one devDependency
  (`@savvy-web/bundler`) and gets a pinned, tested `tsdown` transitively —
  no peer-sync trap.
- A real published escape hatch exists: a power user brings their own
  `tsdown` and composes `@savvy-web/tsdown-plugins`' helpers directly in a
  hand-written build script, reproducing exactly what the front door
  does — `src/index.ts` is the semver'd surface, not leaked bundler
  internals, and nothing the orchestrator does (including the multi-group
  loop and the meta pass) is a second-class private path.
- `@savvy-web/tsdown-plugins` must not import `@savvy-web/silk-effects`,
  which is downstream of this toolchain — importing it would create a
  package build cycle. `resolveNextVersions` is a deliberate second copy
  of the release-plan slice `silk-effects`' planner also computes, for
  exactly that reason.
- Both packages version independently; changesets auto-bumps
  `@savvy-web/bundler` when `@savvy-web/tsdown-plugins` changes, through
  the ordinary dependency relationship, not a fixed/linked group.
