---
type: Interface
title: layers.json
description: "The single source of truth for which layer each app package sits in, a @effected/workspaces LayerPolicy read by silk's package-layering test to hold the live dependency graph to the declared layering."
status: draft
kind: config
resource: ../../packages/silk/layers.json
tags: [architecture, testing]
sources:
  - id: layers-json
    resource: ../../packages/silk/layers.json
  - id: package-layering-test
    resource: ../../packages/silk/__test__/package-layering.test.ts
  - id: layer-policy
    resource: "npm:@effected/workspaces/testing"
    title: LayerPolicy and WorkspaceLayering
generated:
  by: okfit/claude-code
  at: 2026-09-25T02:26:25Z
  body_sha256: ac54a22751d1c4a0e672a07a72de56faa175998c876f53637a918b9ac1c101da
---

# layers.json

## The contract

`packages/silk/layers.json` is a `LayerPolicy` from
`@effected/workspaces/testing`, whose decode is strict: a key the schema
does not model fails the load, so a typo cannot silently drop a
guard.[^layer-policy] It lives in silk because silk is the top of the graph.
Every entry is an npm package name, never a path:[^layers-json]

- **`layers`**: an ordered array of arrays, top layer first. Root
  CLAUDE.md's shape is `L4 silk → L3 cli/mcp/changelog → L2 silk-effects →
  L1 silk-core`; today that is `[["@savvy-web/silk"], ["@savvy-web/cli",
  "@savvy-web/mcp", "@savvy-web/changelog"], ["@savvy-web/silk-effects"],
  ["@savvy-web/silk-core"]]`. Every app package sits in exactly one of
  these.
- **`tooling`**: the packages the build/release toolchain owns (bundler,
  tsdown-plugins, rspress-builder, templates, github-action-builder,
  pnpm-plugin-silk). They may depend on each other and may be depended on
  from any layer, but never reach back into a layer.
- **`unconstrained`**: name globs, today `["@e2e/*",
  "savvy-web-systems"]` — the harness packages and the private workspace
  root. Their own edges are not checked, but no layered or tooling package
  may depend on one.
- **`requiredEdges`**: edges written `"a -> b"` that must exist — today
  `silk -> cli`, `silk -> mcp`, `cli -> silk-effects` and
  `silk-effects -> silk-core`. They are the non-vacuity guard: a discovery
  regression that quietly drops real edges fails here instead of leaving the
  report green.
- `fields` is absent, so all four dependency maps are checked.

## Who reads it, and what it enforces

`packages/silk/__test__/package-layering.test.ts` is the sole reader. It
loads the file with `LayerPolicy.load` and runs
`WorkspaceLayering.checkWorkspace`, which discovers the real workspace
packages — never trusting this file for package existence — and counts an
edge wherever a `dependencies`, `devDependencies`, `peerDependencies` or
`optionalDependencies` entry names a workspace package, whatever its
specifier. The test asserts the report's `violations` are empty, which
means:[^package-layering-test]

1. no package is declared twice, or both declared and matched by an
   `unconstrained` glob;
2. every workspace package is classified;
3. no edge points upward or sideways within a layer, out of `tooling` into
   a layer, or from a checked package into an unconstrained or unclassified
   one;
4. the checked graph has no cycle;
5. every declared package exists on disk, every `requiredEdges` entry is
   present, and at least one edge was found.

A positive control loads the same policy and feeds `WorkspaceLayering.check`
one upward and one same-layer edge, expecting exactly those two reasons back,
so the checker is proven to report what it must.[^package-layering-test]

## What a new workspace edge must do

Adding a dependency between two packages already classified here needs no
edit — the test reads the edge off the live manifest. This file changes only
when a package's layer membership changes, when a wholly new package joins
`layers` or `tooling` (a new `@e2e/*` package is covered by the glob), or
when a load-bearing edge should join `requiredEdges`. Moving a package to a
different layer, or adding an edge that breaks rule 3, fails silk's unit
suite rather than failing silently.[^package-layering-test]

## Related

- [`decisions/carrier-pattern-package-graph.md`](../decisions/carrier-pattern-package-graph.md) —
  the decision this file's `layers` array structurally asserts.
- [`decisions/front-ends-adopt-effected-kit.md`](../decisions/front-ends-adopt-effected-kit.md) —
  why the check runs on the kit's `WorkspaceLayering`.
- [`conventions/package-layering.md`](../conventions/package-layering.md) —
  the layer table and DAG rule in prose.
- [`modules/silk.md`](../modules/silk.md) — the package that owns the file
  and the test.

[^layers-json]: `../../packages/silk/layers.json`
[^package-layering-test]: `../../packages/silk/__test__/package-layering.test.ts`
[^layer-policy]: `npm:@effected/workspaces/testing`
