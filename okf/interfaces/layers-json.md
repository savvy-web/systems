---
type: Interface
title: layers.json
description: "The single source of truth for which layer each app package sits in, read by @e2e/workspace to assert the live workspace:* dependency graph respects the declared layer ordering and stays acyclic."
status: draft
kind: config
resource: ../../e2e/workspace/layers.json
tags: [architecture, testing]
sources:
  - id: layers-json
    resource: ../../e2e/workspace/layers.json
  - id: package-graph-test
    resource: ../../e2e/workspace/__test__/e2e/package-graph.e2e.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 1fe32a9b41f5516af97bbca5af1fe470257dac80e704bb43858c7cebaa7ff128
---

# layers.json

## The contract

`e2e/workspace/layers.json` promises three sets, each an array of npm
package names:

- **`layers`**: an ordered array of arrays — L4 → L1. Root CLAUDE.md's shape
  is `L4 silk → L3 cli/mcp/changelog → L2 silk-effects → L1 silk-core`; today
  that is `[["@savvy-web/silk"], ["@savvy-web/cli", "@savvy-web/mcp",
  "@savvy-web/changelog"], ["@savvy-web/silk-effects"],
  ["@savvy-web/silk-core"]]`. Every app package sits in exactly one of
  these, at exactly one index.[^layers-json]
- **`tooling`**: a flat array of packages the build/release toolchain owns
  (bundler, tsdown-plugins, rspress-builder, templates,
  github-action-builder, pnpm-plugin-silk). Tooling packages are
  unconstrained relative to each other and may be depended on from any app
  layer, but may never depend back into an app layer.[^layers-json]
- **`harness`**: `["@e2e/*"]` — the harness band is exempt from every rule
  below; an `@e2e/*` package may depend on anything.[^layers-json]

## Who reads it, and what it enforces

`@e2e/workspace`'s `package-graph.e2e.test.ts` is the sole reader. It
discovers every real `packages/*/package.json` and `e2e/*/package.json` off
disk — never trusting `layers.json` for package existence — extracts every
`dependencies`/`devDependencies`/`peerDependencies` edge whose specifier
starts with `workspace:`, classifies each endpoint against this file, and
checks:[^package-graph-test]

1. every name declared in `layers` or `tooling` is unique to one layer (no
   package listed twice);
2. every `workspace:*` edge out of an app-layer package either lands in a
   strictly higher-numbered layer (i.e. a lower Lx) or in `tooling` — never
   sideways within the same layer, never backward into a lower-numbered
   layer;
3. no edge out of `tooling` reaches into an app layer;
4. any package the live graph contains but this file does not classify is
   itself a violation;
5. the whole graph (all discovered packages, not just app layers) passes a
   three-colour DFS acyclicity check.[^package-graph-test]

Four non-vacuity controls guard the test itself: every name `layers.json`
declares must actually be discovered on disk, at least one `workspace:*`
edge must be found at all, and three specific load-bearing edges
(`silk-effects -> silk-core`, `cli -> silk-effects`, `silk -> cli`) must be
present — so a broken glob or a discovery regression fails loudly instead
of letting the offenders assertion pass vacuously.[^package-graph-test]

## What a new workspace:* edge must do

Adding a `workspace:*` dependency between two packages already classified
in `layers`/`tooling` needs no edit here — the test reads the edge off the
live manifest and checks it against the existing classification. This file
changes only when a package's layer membership itself changes, or when a
wholly new package joins `layers`, `tooling`, or (implicitly, via the
`@e2e/*` glob) the harness band. Moving a package to a different layer, or
adding an edge that would violate rule 2 above, fails
`package-graph.e2e.test.ts` rather than failing silently.[^package-graph-test]

## Related

- [`decisions/carrier-pattern-package-graph.md`](../decisions/carrier-pattern-package-graph.md) —
  the decision this file's `layers` array structurally asserts.
- [`conventions/package-layering.md`](../conventions/package-layering.md) —
  the layer table and DAG rule in prose.
- [`modules/e2e.md`](../modules/e2e.md) — `@e2e/workspace`'s place among the
  harness's four coverage tiers.

[^layers-json]: `../../e2e/workspace/layers.json`
[^package-graph-test]: `../../e2e/workspace/__test__/e2e/package-graph.e2e.test.ts`
