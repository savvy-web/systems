---
type: Module
title: silk-core
description: L1 domain core of the Silk package graph — platform-free schemas, tagged errors, and the frozen PrBody contract.
kind: package
resource: ../../packages/silk-core
status: draft
tags: [architecture]
sources:
  - id: arch
    resource: ../../packages/silk-core/src
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: f762b55ef49acf0cef426c2079073f0ce2c06b6029362ca054bc0dc1e2ce9906
---

# silk-core

## Boundary

`@savvy-web/silk-core` (`packages/silk-core`) is the bottom layer (L1) of the Silk package graph: Effect `Schema` value objects, `Data.TaggedError` classes, and pure contracts, with nothing else. Nothing under `src/` may import `node:*`, `@effect/platform*`, or `effect/unstable/process`, or touch the `process` identifier at all — there is no directory carve-out, unlike the engine layer above it.[^arch] `__test__/boundaries.test.ts` enforces this by tokenizing `src/` (rather than pattern-matching) and failing on the first file that touches `process` or names a forbidden module, with no exception list (`packages/silk-core/__test__/boundaries.test.ts`).[^arch] [`silk-effects`](silk-effects.md) imports this package's shared scanner by computed-path `import()` rather than duplicating it, so its own engine-boundary gate cannot drift from this one.[^arch]

It ships as a documented API surface (`meta: true`, API Extractor runs on prod builds) with a single root export, ESM-only, built through the `@savvy-web/bundler` front door.[^arch] `@savvy-web/silk-effects` depends on it as a `workspace:*` dependency and re-exports every symbol under the same name, with the same type-only/value split, so downstream consumers of silk-effects see no change.[^arch]

## Owner

Part of the [package-layering](../conventions/package-layering.md) convention silk-core sits at the bottom of.

## What it holds

The domain model extracted from silk-effects' `errors/`, `schemas/`, `pr-body/`, and `utils/` directories — every candidate file was inspected for platform imports, `process` reads, and imports of a non-core sibling before moving:[^arch]

| Directory | Contents |
| --- | --- |
| `errors/` | `BiomeSyncError`, `ChangesetConfigError`, `ConfigNotFoundError`, `PublishTargetBindingError`, `WorkspaceAnalysisError` |
| `schemas/` | `BiomeConfig`, `ConfigDiscoverySchemas`, `SavvyInstallSection`, `SavvySections`, `VersioningSchemas`, `WorkspaceAnalysisSchemas` |
| `pr-body/` | `body`, `diagnostics`, `index`, `linked-issue`, `markers`, `references`, `region` — the [PR body contract](../interfaces/pr-body-contract.md) |
| `utils/` | `TrailingSlash` (`trimTrailingSlashes`, a public export here) |

The rule for future moves: a candidate that imports a silk-effects sibling stays in silk-effects — moving it would invert the layer edge, and Biome's `noImportCycles` rule would reject it. A schema belongs here only if it needs no platform; anything needing a `FileSystem`, a subprocess, or a clock is a silk-effects service.[^arch]

## Boundaries and invariants

- **No platform, no `process`, no allowlist** under `src/`, enforced by `__test__/boundaries.test.ts`.[^arch]
- **`PrBody.Markers` is frozen.** The `silk-release:` token names the contract, not the emitting action; byte-parity with `silk-release-action` is pinned by fixture and drift-lint tests. See [pr-body-contract](../interfaces/pr-body-contract.md).[^arch]
- **`@effected/workspaces` is a required peer, not a regular dependency.** `SilkPublishConfig` extends its `PublishConfig` class and `AnalyzedWorkspace` carries its value classes; if silk-core held its own copy, silk-core and silk-effects could resolve two instances and `instanceof`/Schema identity would break across the layer edge. See [kit-effect-peers-via-catalog](../decisions/kit-effect-peers-via-catalog.md). `@effected/templates` and `@effected/github-references` are regular dependencies because only types and functions cross the boundary there.[^arch]
- **`prepare: turbo run build:dev` stays** — silk-effects consumes this package as `workspace:*` through a `link:` into `dist/dev/pkg`. See [workspace-prepare-scripts](../conventions/workspace-prepare-scripts.md).[^arch]
- **Cross-package `{@link}` targets are plain backticks, never `{@link}`.** API Extractor cannot resolve a link through a re-export, so a silk-effects doc comment naming a silk-core symbol (and vice versa) uses a code span instead.[^arch]

[^arch]: `../../packages/silk-core/src`
