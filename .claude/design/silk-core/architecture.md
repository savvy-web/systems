---
status: current
module: silk-core
category: architecture
created: 2026-09-12
updated: 2026-09-12
last-synced: 2026-09-12
completeness: 90
related:
  - ../workspace/package-layering.md
  - ../silk-effects/architecture.md
  - ../silk-effects/kit-peer-dependencies.md
  - ../silk-effects/pr-body.md
  - ../silk-effects/workspace-analysis.md
  - ../silk-effects/hook-sections.md
dependencies:
  - ../workspace/package-layering.md
---

# @savvy-web/silk-core architecture

The bottom layer (L1) of the Silk package graph: the platform-free domain model — schemas, tagged errors and the frozen `PrBody` contract — extracted from `@savvy-web/silk-effects`, which depends on it and re-exports every symbol under the same name. Part of the layering described in [package-layering.md](../workspace/package-layering.md).

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [What moved](#what-moved)
- [The L1 boundary test](#the-l1-boundary-test)
- [The shared scanner](#the-shared-scanner)
- [`@effected/workspaces` is a peer](#effectedworkspaces-is-a-peer)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`@savvy-web/silk-core` (`packages/silk-core`) holds the part of the Silk engine that needs no platform: Effect `Schema` value objects, `Data.TaggedError` classes and pure contracts. Nothing under `src/` may import `node:*`, `@effect/platform*` or `effect/unstable/process`, or touch the `process` identifier — and unlike the engine layer above it, there is no directory carve-out. It is a documented API surface (`meta: true`, API Extractor runs on prod builds) with a single root export, built ESM-only through the `@savvy-web/bundler` front door, at version `0.1.0`.

Consumers of `@savvy-web/silk-effects` see no change: its `src/index.ts` re-exports every moved symbol from `@savvy-web/silk-core` with the same names and the same type-only/value split. The only new thing in the world is the layer edge.

## Current State

Extracted and green: the move was mechanical (`git mv`, imports repointed, no consumer edits needed — cli, mcp, silk and changelog typecheck against the unchanged silk-effects surface). Unit tests moved with their subjects, so silk-effects' count dropped by exactly the moved tests and none were lost. The vitest-agent discovery never collects `__test__/utils/`, which surfaced that silk-effects' `TrailingSlash` tests had never actually run; they run here now.

## What moved

Every candidate file under silk-effects' `errors/`, `schemas/`, `pr-body/` and `utils/` was inspected for platform imports, `process` reads and imports of a non-core sibling; all qualified.

| Directory | Files | Imports |
| --- | --- | --- |
| `errors/` | `BiomeSyncError`, `ChangesetConfigError`, `ConfigNotFoundError`, `PublishTargetBindingError`, `WorkspaceAnalysisError` | `effect` |
| `schemas/` | `BiomeConfig`, `ConfigDiscoverySchemas`, `SavvyInstallSection`, `SavvySections`, `VersioningSchemas`, `WorkspaceAnalysisSchemas` | `effect`, `@effected/templates`, `@effected/workspaces`, `../utils/TrailingSlash.js` |
| `pr-body/` | `body`, `diagnostics`, `index`, `linked-issue`, `markers`, `references`, `region` | `effect`, `@effected/github-references`, each other |
| `utils/` | `TrailingSlash` | none |

Two details of the move are worth knowing:

- `ConfigDiscoverySchemas` mentioned `process.cwd()` only in a doc comment; it was reworded. The scanner strips comments so the mention would not have failed the gate, but the reworded comment is also more honest now that the service takes a required `cwd`.
- `utils/TrailingSlash.ts` moved rather than being duplicated because `WorkspaceAnalysisSchemas` (moving) and `services/SilkPublishability.ts` (staying) both import it. `trimTrailingSlashes` is therefore a public export of silk-core; silk-effects imports it from silk-core and does NOT re-export it, so silk-effects' surface is unchanged and `src/utils/` in silk-effects is gone.

The rule for future moves: **a candidate that imports a silk-effects sibling stays in silk-effects.** Moving it would invert the layer edge (Biome's `noImportCycles` would also reject it). Add a schema here only if it needs no platform — anything that needs a `FileSystem`, a subprocess or a clock is a silk-effects service.

Cross-package `{@link}` targets became backticks on both sides of the edge: API Extractor cannot resolve a link through a re-export ("This type of declaration is not supported yet by the resolver"), so a silk-effects doc comment naming `BiomeConfig` and a silk-core comment naming `BiomeSchemaSync` both use plain code spans. The prod `issues.json` is clean for both packages.

## The L1 boundary test

`__test__/boundaries.test.ts` walks `src/` and fails on the first offender for either question — does the file touch `process`, does it name a forbidden module — with no exception list. The spec makes this test THE L1 enforcement, so it was hardened past the plan's verbatim regex sketch (which a review found porous in eleven shapes): the scanner tokenizes rather than pattern-matches. Positive and negative controls sit beside the gate so it cannot pass vacuously; the scanner has its own unit suite (`__test__/boundaries-scanner.test.ts`).

`__test__/utils/` is a helper directory the vitest-agent discovery never collects — put tests beside it, never in it.

## The shared scanner

`__test__/utils/boundaries.ts` tokenizes just enough TypeScript to separate code from comments and string/template/regex literals, then answers two questions: which module specifiers a file names in any form (`import … from`, bare `import`, `export … from`, `import()`, `require()`), and whether it touches the `process` identifier in code — as a member root, a bracket access, a destructuring source, an interpolation, and via `globalThis.process` / `global.process` (a shape closed after review; `myGlobal.process` stays clean). Specifiers are matched against `node:*`, bare Node builtins (`node:module`'s `builtinModules`), `process`, `@effect/platform*` and `effect/unstable/process`. Known blind spot: `globalThis["process"]` is not caught, because string bodies are stripped before the scan.

silk-effects' engine gate (`packages/silk-effects/__test__/boundaries.test.ts`) uses the SAME scanner, imported rather than copied, so the two gates cannot drift. It reaches it by a **computed-path `import()`** over `pathToFileURL(join(import.meta.dirname, "..", "..", "silk-core", "__test__", "utils", "boundaries.ts"))` with a one-symbol hand-written cast. That mechanism was a ruling, not an accident: the shared `ecma.json` base sets `rootDir: ${configDir}` and the package tsconfigs include `__test__`, so any static cross-package specifier fails `tsc --noEmit` with TS6059 (and would flow into the dts pass); a `paths` mapping cannot fix `rootDir`; and promoting the scanner to a workspace package would add an upward test edge. The DAG check reads manifests, not test imports, so the relative test-only edge is legal — and if a future move breaks it, it breaks loudly. The fallback if the computed import ever becomes untenable is `lib/test-utils/boundaries.ts` with both packages importing it; duplicating the scanner is not an option.

## `@effected/workspaces` is a peer

`@effected/workspaces` sits in `peerDependencies` (and `devDependencies`), not `dependencies`, even though `WorkspaceAnalysisSchemas` imports it. `SilkPublishConfig` extends its `PublishConfig` class and `AnalyzedWorkspace` carries its `PublishTarget`/`TagStyle`/`VersioningStrategy` value classes, and silk-effects peers on the same package for the same reason. If silk-core held its own copy, silk-core and silk-effects could resolve two instances and `instanceof`/Schema identity would break across the layer edge — the two-copies failure documented in [kit-peer-dependencies.md](../silk-effects/kit-peer-dependencies.md). The cost is that a consumer of silk-core alone must install the peer; silk-effects already has that posture, so nothing new is asked of anyone. `@effected/templates` and `@effected/github-references` are regular dependencies: only types and functions cross the boundary there. `src/index.ts` re-exports nothing from the kit.

## Boundaries and invariants

- **No platform, no `process`, no allowlist** under `src/`, enforced by the boundary test.
- **`PrBody.Markers` is FROZEN.** The `silk-release:` token names the contract, not the emitting action. Byte-parity with `silk-release-action` is pinned by `__test__/fixtures/pr-body/expected.json` and `__test__/pr-body/skill-sync.test.ts` drift-lints `plugins/silk` skills against the literals (both moved here with the contract). See [pr-body.md](../silk-effects/pr-body.md).
- **Kit ownership is unchanged**: `VersioningStrategy`/`TagStyle`/`PublishTarget` from `@effected/workspaces`, `Section`/`SectionId`/`CommentStyle` from `@effected/templates`, the issue-reference grammar from `@effected/github-references`.
- **`prepare: turbo run build:dev` stays** — silk-effects consumes this package as `workspace:*` through a `link:` into `dist/dev/pkg` ([install-orchestration.md](../workspace/install-orchestration.md)).
- **Peer for identity, dependency for everything else** (above).

## Rationale

### Why a separate package rather than a directory rule

silk-effects already had role-based folders; the gap was that nothing stopped a schema from growing a `FileSystem` import. A package boundary makes "no platform" a manifest-level fact the DAG check and the bundler both see, gives the domain model its own documented API surface, and lets a future consumer (an action, a Bun tool) take the schemas without the engine's kit closure.

### Why re-export rather than migrate consumers

Every consumer already imports from `@savvy-web/silk-effects`, and the engine genuinely needs the same symbols. Re-exporting keeps one import path per symbol for engine consumers while the layer edge does the structural work. Direct imports from silk-core are for consumers that want only the domain model.

## Related documentation

- [package-layering.md](../workspace/package-layering.md) — the layer table and DAG check this package sits at the bottom of.
- [silk-effects/architecture.md](../silk-effects/architecture.md) — the engine that re-exports this package.
- [kit-peer-dependencies.md](../silk-effects/kit-peer-dependencies.md) — the two-copies identity failure behind the peer.
- [pr-body.md](../silk-effects/pr-body.md), [workspace-analysis.md](../silk-effects/workspace-analysis.md), [hook-sections.md](../silk-effects/hook-sections.md) — the subsystems whose schemas now live here.
