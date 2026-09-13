---
type: Convention
title: Respect the four-layer package graph and the non-import invariant
description: "An edge may only point from a higher layer to a strictly lower one (L4 silk -> L3 cli/mcp/changelog -> L2 silk-effects -> L1 silk-core), same-layer packages never reference each other, and cli/silk/mcp never import each other except silk's src/bin/ carrier shims — asserted by @e2e/workspace against layers.json."
stale_after: 2027-03-12T00:00:00-04:00
tags: [architecture]
sources:
  - id: package-layering
    resource: ../../e2e/workspace/__test__/e2e/package-graph.e2e.test.ts
  - id: claude-md
    resource: ../../CLAUDE.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 0c35b0e2295fb4472ceec5f18204f7080c90639891c89450710cf58f84556f3d
---

# Respect the four-layer package graph and the non-import invariant

Before adding or reviewing a `workspace:*` edge between packages, check it against the layer table:

```text
L4  @savvy-web/silk                      carrier + config shims (deps on L3 + L2; bins over ./main)
L3  @savvy-web/cli   @savvy-web/mcp      peer front ends (bin / main / index)
    @savvy-web/changelog                 leaf identity (bundles L2 for the changesets CLI)
L2  @savvy-web/silk-effects              engine: services, programs, envelopes
L1  @savvy-web/silk-core                 domain model: schemas, errors, pure contracts
--- tooling band (build-time only; any layer may devDepend on it; it depends on no app layer) ---
    @savvy-web/bundler  @savvy-web/tsdown-plugins  @savvy-web/rspress-builder
    @savvy-web/templates  @savvy-web/github-action-builder  @savvy-web/pnpm-plugin-silk
--- harness band (private, may depend on anything) ---
    @e2e/*
```

The rules:

- An edge (`dependencies`, `peerDependencies`, or `devDependencies`, `workspace:*` only) may point from a higher layer to a strictly lower one, or from any layer into the tooling band.
- Packages in the same layer never reference each other. `cli`, `mcp`, and `changelog` are peers.
- A tooling package never references an app-layer package.
- The harness band (`@e2e/*`) is unconstrained.
- The whole workspace graph topologically sorts (no cycles).[^package-layering]

`@savvy-web/silk-effects` re-exports every `@savvy-web/silk-core` symbol under the same name, so a consumer of the engine sees one surface even though the layer edge between them is new. See [silk-effects](../modules/silk-effects.md) and [silk-core](../modules/silk-core.md).

## The non-import invariant and its one exception

`@savvy-web/cli`, `@savvy-web/silk`, and `@savvy-web/mcp` must NOT import each other — cli and mcp are L3 peers depending only on `@savvy-web/silk-effects` in-repo. The ONE sanctioned exception is silk's `src/bin/savvy.ts` and `src/bin/savvy-mcp.ts`, which each import `main` from `@savvy-web/cli/main` or `@savvy-web/mcp/main` respectively and call it — four lines of code implementing the carrier pattern (see [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md)). Nothing else under silk's `src/` may import either front end; library code in the three packages never imports a sibling.[^package-layering][^claude-md]

Each front end splits its process entry into three files with distinct jobs: `src/bin.ts` (shebang, imports and calls `main`, nothing else), `src/main.ts` (exports `main`, owns the process — runtime assembly, crash guards, `NodeRuntime.runMain`), and `src/index.ts` (the importable library barrel, no side effects, never exports `main`). This split is what makes the carrier shim possible: it imports `main` without pulling anything the barrel exports.[^package-layering]

## The engine boundary

`@savvy-web/silk-effects` is the engine both front ends run, so it must not read `process` directly — a read there bakes one host's environment into the other. The one carve-out is two top-level directories, `lint/` and `commitlint/`, which are host adapters (entry points invoked by lint-staged, markdownlint-cli2, and commitlint as foreign host processes) and so read `process` themselves. There is no per-file allowlist beyond these two directories.[^package-layering]

## The DAG check

`@e2e/workspace` (`e2e/workspace/__test__/e2e/package-graph.e2e.test.ts`) reads every `packages/*/package.json` and `e2e/*/package.json` off disk, extracts every `workspace:*` edge, classifies each endpoint against `layers.json` (see [layers-json](../interfaces/layers-json.md)), and asserts the rule list above with offenders rendered as `"<from> -> <to> (<field>)"`. A three-colour DFS proves the whole workspace acyclic; two positive-control fixture graphs (a sideways L3→L3 edge, a three-node cycle) keep the check from passing vacuously.[^package-layering]

[^package-layering]: `../../e2e/workspace/__test__/e2e/package-graph.e2e.test.ts` — the DAG check asserting the rule list against `layers.json`
[^claude-md]: [CLAUDE.md](../../CLAUDE.md), "Conventions" — the non-import invariant
