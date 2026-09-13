---
type: Decision
title: Carrier-pattern package graph
description: "@savvy-web/silk carries the savvy/savvy-mcp bins as ordinary bin entries over the front ends' ./main contract, replacing a pnpm-only publicHoistPattern that only ever worked for one package manager."
status: draft
tags: [architecture, release]
sources:
  - id: layering
    resource: ../../e2e/workspace/layers.json
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: ffb496e26ec84f20cd29ca9e0484f8f919c885827347a14a6c66a5acde818b3b
---

# Carrier-pattern package graph

## Context

Before this work the app packages had a flat "everything depends on silk-effects" shape with two soft spots: the `savvy`/`savvy-mcp` bins reached a consumer only because `@savvy-web/pnpm-plugin-silk` public-hoisted `@savvy-web/cli` and `@savvy-web/mcp` — a pnpm-only mechanism a yarn/npm/bun consumer never got — and silk consumed silk-effects through a devDependency the build transform re-injected into the published manifest. Implements savvy-web/systems#631; the pattern is borrowed from `okfit`, a sibling repo with the same plugin/cli/mcp shape.[^layering]

## Decision

Each front end splits its process entry into three files with distinct jobs: `src/bin.ts` (shebang shim, no other content), `src/main.ts` (exported as `./main`, owns the process — runtime assembly, crash guards, `NodeRuntime.runMain`), and `src/index.ts` (the side-effect-free library barrel at `.`, never exports `main`). `@savvy-web/cli/main` exports `main(): void`; `@savvy-web/mcp/main` exports `main(): Promise<void>` and registers `uncaughtException`/`unhandledRejection` handlers before dynamically importing the server graph. This split is what makes the carrier possible: a shim elsewhere can import `main` and call it without pulling anything the barrel exports and without double-registering process guards.[^layering]

`@savvy-web/silk` — the one package a consumer installs — owns the bin entries directly: `"bin": { "savvy": "./src/bin/savvy.ts", "savvy-mcp": "./src/bin/savvy-mcp.ts" }`. Each shim is a four-line `import { main } from "@savvy-web/cli/main"; main();` (respectively `await main()` for mcp) under a shebang. Installing silk alone creates the `.bin` entries off that single direct dependency under every package manager, with no hoist pattern and no config dependency. The front ends keep their own bins as mirrors, not alternatives, so a direct install of a front end keeps working; the shims are the ONE sanctioned exception to the cli/mcp/silk non-import invariant — `packages/silk/src/bin/` is the only place silk may import `@savvy-web/cli` or `@savvy-web/mcp`.[^layering]

The plan considered making silk a *pure* carrier with silk-effects extracted into a fixtures package. It is not: nine files under `packages/silk/src/` import [`silk-effects`](../modules/silk-effects.md) (the config shims re-shape engine exports for external tool loaders), so `@savvy-web/silk-effects` is declared honestly as a regular `dependencies` entry of silk, not a devDependency the build transform re-injects — silk is "carrier + config shims."[^layering]

Four named layers (L4 silk → L3 cli/mcp/changelog → L2 silk-effects → L1 silk-core, plus an unconstrained tooling band and harness band) are asserted structurally by `@e2e/workspace`, which reads every `package.json` off disk, extracts every `workspace:*` edge, classifies each endpoint against `layers.json`, and proves the whole workspace graph acyclic via a three-colour DFS. `layers.json` is the single source of truth for layer membership.[^layering]

`@savvy-web/pnpm-plugin-silk`'s `publicHoistPattern` no longer lists `@savvy-web/cli` or `@savvy-web/mcp`; `@savvy-web/changelog` **stays hoisted** because the changesets engine resolves it BY ID from the consumer root — a resolution need, not a bin. That makes release order load-bearing: a silk that carries the bins must be published before or with the pnpm-plugin-silk that stops hoisting, or a consumer on a bin-less silk loses `savvy` from PATH.[^layering]

The repo root's own `@savvy-web/*` devDependencies are `@savvy-web/silk` and `@savvy-web/changelog` only — `@savvy-web/cli` and `@savvy-web/mcp` were dropped as root devDependencies, removing the three-provider ambiguity the carrier pattern exists to eliminate.[^layering]

## Alternatives rejected

- **Keep the pnpm public hoist.** A public hoist is a pnpm-only mechanism configured by a config dependency; a consumer on npm, yarn, or bun, or one that has not adopted pnpm-plugin-silk, never got the bins. A `bin` entry on the package the consumer already installs works under every manager with nothing to configure.[^layering]
- **Grep-guarded prose invariant instead of a structural DAG check.** Naming the layers in `layers.json` and reading the live manifests turns "cli must not import silk" into a rule with an offender list, extends it to the L1/L2 split, and catches classes of edge — a tooling package growing an app dependency, a sideways L3 edge added for convenience — a source grep would never see.[^layering]

## Consequences

- npm bin ownership is ambiguous by design: under npm's flat layout, `.bin` symlinks may resolve to a front end's own bin file rather than silk's shim; only pnpm's isolated layout proves it is *silk's* shim doing it. If silk's shim must be the linked file under npm too, the front ends would have to stop declaring `bin` — a product decision not taken.[^layering]
- `github-info`'s environment read lives inside `@changesets/get-github-info`, a dependency with no token option, so engine behaviour still varies by host `cwd` through that one dependency — a documented gap, not an allowlist entry.[^layering]
- Release sequencing between silk and pnpm-plugin-silk is now a manual rule, not something changesets enforces, since pnpm-plugin-silk versions independently.
- See [silk-pins-siblings-as-dependencies](silk-pins-siblings-as-dependencies.md) for the dependency-versus-peer half of this decision, and [package-layering](../conventions/package-layering.md) for the layer table and DAG rule.

[^layering]: `../../e2e/workspace/layers.json`
