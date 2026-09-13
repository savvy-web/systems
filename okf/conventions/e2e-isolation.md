---
type: Convention
title: Catalog and workspace resolution coverage lives only in e2e/
description: "A package's own integration tests must never resolve catalog: or workspace:* against the host repo; that coverage belongs to e2e/, which spawns the built tool or imports the built artifact with cwd set to an isolated fixture that owns its own pnpm-workspace.yaml."
status: draft
stale_after: 2026-12-11T00:00:00Z
tags: [testing]
sources:
  - id: e2e-claude-md
    resource: ../../e2e/CLAUDE.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 69c5657a2eaa75d4f8735d42d9ed1e3c337540ddf4ca287c7a112deef8620bc5
---

# Catalog and workspace resolution coverage lives only in e2e/

## The rule

Never write a test — inside `packages/*` or anywhere else — that lets
`catalog:`/`workspace:*` specifier resolution root at the host repo. Any
test that exercises `workspaces-effect`'s `CatalogResolver` (which reads
`process.cwd()`) belongs in [`modules/e2e.md`](../modules/e2e.md), and it
must isolate resolution by one of two means:

- **Subprocess**: spawn the built tool (`node savvy.build.ts`) with `cwd`
  set to a fixture directory that owns its own `pnpm-workspace.yaml`, so the
  resolver's root-walk stops at the fixture instead of climbing to the
  monorepo root.[^e2e-claude-md]
- **In-process hermetic**: for code that cannot subprocess but still
  triggers host resolution, `chdir` into a temp dir carrying its own empty
  `pnpm-workspace.yaml` for the duration of the call, and restore the
  previous cwd in a `finally`.[^e2e-claude-md]

A fixture that triggers resolution always carries its own
`pnpm-workspace.yaml` (inline catalogs or sibling stubs) for exactly this
reason, and is test data, never a workspace member — it is Biome-ignored
and outside every real `packages:` glob.[^e2e-claude-md]

## Why

Resolution coverage would otherwise see the host's real catalogs, making a
"passing" resolution test meaningless — it would prove nothing about a
consumer's isolated resolution and everything about this monorepo's own
`pnpm-workspace.yaml`, which is exactly the state the test needs to exclude.
Concentrating this coverage in `e2e/` keeps the isolation guarantee in one
place instead of re-deriving it per package.[^e2e-claude-md]

## Related

- [`modules/e2e.md`](../modules/e2e.md) — the harness area this convention
  governs, its four coverage tiers, and the fixture conventions.
- [`conventions/effect-vitest-testing.md`](effect-vitest-testing.md) — the
  suite-wide `@effect/vitest` conventions this convention sits alongside.

[^e2e-claude-md]: ../../e2e/CLAUDE.md
