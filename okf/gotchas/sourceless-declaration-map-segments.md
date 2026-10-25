---
type: Gotcha
status: draft
title: A green bundle followed by EISDIR from inside API Extractor's SourceMapper is a declaration-map segment with no source, not a filesystem problem
description: "rolldown 1.2.15+ writes source-less (1-field) mapping segments into .d.ts.map for declarations TypeScript synthesizes with no source position — the hoisted `declare const X_base` behind a class whose heritage clause is a call expression; API Extractor's SourceMapper resolves such a segment to the .d.ts's own directory and readFiles it, so the meta pass dies with EISDIR. generateMeta scrubs those segments before every run."
resource: ../../packages/tsdown-plugins/src/meta/scrub-declaration-maps.ts
tags: [build, compat]
stale_after: 2027-04-25T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-25T14:59:20Z
sources:
  - id: scrub-declaration-maps
    resource: ../../packages/tsdown-plugins/src/meta/scrub-declaration-maps.ts
  - id: generate
    resource: ../../packages/tsdown-plugins/src/meta/generate.ts
  - id: issue817-probe
    resource: ../../packages/bundler/__test__/e2e/fixtures/issue817-probe
  - id: scrub-unit-test
    resource: ../../packages/tsdown-plugins/__test__/meta/scrub-declaration-maps.test.ts
  - id: rushstack-6156
    resource: https://github.com/microsoft/rushstack/issues/6156
integrity:
  generated:
    body: c5bc3ab0490ddf1a
---

# A green bundle followed by EISDIR from inside API Extractor's SourceMapper is a declaration-map segment with no source, not a filesystem problem

## What you see

A `--target prod` build whose JS and dts passes finish clean, then the meta
pass fails from inside `@microsoft/api-extractor` with
`EISDIR: illegal operation on a directory` — sometimes phrased as
`Target is a folder, not a file: undefined` — with a stack through its
`SourceMapper`. The package it fails on exports a class whose heritage
clause is a call expression: an Effect `Schema.Class`/`Data.TaggedError`
subclass, or any mixin factory (`class AuditedRecord extends
withAuditTrail()`). TypeScript 7.1 does not change the outcome; tsgo emits
the same shape (savvy-web/systems#817).

## What you will wrongly conclude

That something on disk is wrong — a directory where a file should be, a
permissions or symlink problem in `dist/`, a stale `node_modules`, or a
race with another build writing the same output. Reinstalling, cleaning
`dist/` and rebuilding reproduce it exactly, because the input is
deterministic.

## What is actually true

For such a class, TypeScript synthesizes a hoisted `declare const X_base`
declaration that has no source position. rolldown 1.2.15+ writes a
generated-only mapping segment for it — a 1-field segment with no source
index, line or column — into the `.d.ts.map` beside the bundled and
per-module declarations. API Extractor reads the `.d.ts.map` beside every
input it analyzes, and its `SourceMapper` resolves a source-less item to
the `.d.ts`'s own **directory** and then `readFile`s that path, which is
the `EISDIR`. The upstream report is microsoft/rushstack#6156, with PR
6157 open and no maintainer response as of 2026-10-25.[^rushstack-6156]

`@savvy-web/tsdown-plugins` removes the trap at its input: the `@internal`
`scrubSourcelessMappings(mapPath)` decodes a map with
`@jridgewell/sourcemap-codec`, drops every 1-field segment and rewrites the
file only when something was removed; `scrubDeclarationMapsUnder(dir)`
applies it to every `.d.ts.map`/`.d.cts.map`/`.d.mts.map` under a
directory, returning 0 for a missing one.[^scrub-declaration-maps]
`generateMeta` calls it once on the bundled dts directory Run A models and,
when `splitDiagnostics`, once on the per-module declarations directory Run
B reads — before either run, not per entry.[^generate] Removing a
source-less segment is lossless for every reader: it carries no original
position a consumer could map to.

Regression coverage is the unit test over the scrub itself and the
`issue817-probe` e2e fixture, an `AuditedRecord extends withAuditTrail()`
mixin built prod in the bundler's `build.e2e.test.ts`, asserting
`issues.json` `buildOk` and that the `.api.json` exists.[^scrub-unit-test][^issue817-probe]
When rushstack ships the fix and the `catalog:build` api-extractor range
moves past it, the scrub becomes a no-op and this concept should be
deprecated rather than left to read as current.

## Related

- [`modules/tsdown-plugins.md`](../modules/tsdown-plugins.md) — the meta
  pass this scrub precedes.
- [`interfaces/build-issues-json.md`](../interfaces/build-issues-json.md) —
  where the crash would otherwise land as `buildOk: false`.
- [`decisions/typescript-7-1-dts-api.md`](../decisions/typescript-7-1-dts-api.md)
  — why API Extractor still compiles with its own TypeScript 6.

[^scrub-declaration-maps]: `../../packages/tsdown-plugins/src/meta/scrub-declaration-maps.ts`
[^generate]: `../../packages/tsdown-plugins/src/meta/generate.ts`
[^issue817-probe]: `../../packages/bundler/__test__/e2e/fixtures/issue817-probe`
[^scrub-unit-test]: `../../packages/tsdown-plugins/__test__/meta/scrub-declaration-maps.test.ts`
[^rushstack-6156]: <https://github.com/microsoft/rushstack/issues/6156>
