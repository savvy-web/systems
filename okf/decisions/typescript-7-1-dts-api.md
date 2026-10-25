---
type: Decision
title: Emit declarations through TypeScript 7.1's compiler API, pinned exactly in tsdown-plugins
description: "@savvy-web/tsdown-plugins pins typescript 7.1.0-beta exactly (not catalog:silk) and forces dts.generator: tsgo with an explicit tsgo.moduleUrl, while @microsoft/api-extractor keeps its own TypeScript 6 through the existing override."
status: stable
tags: [build, deps, compat]
supersedes: typescript-6-dts-pin.md
generated:
  by: okfit/claude-code
  at: 2026-10-25T21:27:42Z
sources:
  - id: tp-manifest
    resource: ../../packages/tsdown-plugins/package.json
  - id: tp-target-groups
    resource: ../../packages/tsdown-plugins/src/build/target-groups.ts
  - id: tp-parse
    resource: ../../packages/tsdown-plugins/src/dts/parse.ts
  - id: tp-api-extractor
    resource: ../../packages/tsdown-plugins/src/meta/api-extractor.ts
  - id: tp-logger
    resource: ../../packages/tsdown-plugins/src/report/tsdown-logger.ts
  - id: ts-7-1-schedule
    resource: https://github.com/microsoft/TypeScript/issues/63703
  - id: rushstack-ts7
    resource: https://github.com/microsoft/rushstack/issues/6033
verified:
  - by: human:spencer
    at: 2026-10-25T14:47:01Z
  - by: human:spencer
    at: 2026-10-25T14:56:24Z
  - by: human:spencer
    at: 2026-10-25T21:24:55Z
integrity:
  generated:
    body: 8aa2ec3f6441d3f3
  verified:
    by: human:spencer
    at: 2026-10-25T21:24:55Z
    content: 5a98db2eaaca766b
---

# Emit declarations through TypeScript 7.1's compiler API, pinned exactly in tsdown-plugins

## Context

[decisions/typescript-6-dts-pin.md](typescript-6-dts-pin.md) held
`@savvy-web/tsdown-plugins` on TypeScript 6 with `dts.generator: "tsc"`
because TypeScript 7.0's main export is a version stub with no compiler
API, and because `rolldown-plugin-dts`'s tsgo generator of the time spawned
a CLI with `--rootDir dirname(tsconfig)`, which failed with `TS6059` on the
temp-dir tsconfig this package writes. Both premises have moved:

- TypeScript 7.1 exposes the compiler API at subpaths — `typescript/sync`,
  `typescript/async`, `typescript/fs`, `typescript/ast`, `typescript/ast/is`
  — rather than the main export. Its release candidate is scheduled for
  2026-11-10 and stable for 2026-11-24.[^ts-7-1-schedule]
- `rolldown-plugin-dts` 0.29.0-beta.x, the line `tsdown` 0.23.2 resolves,
  replaced its CLI tsgo generator with the 7.1 API: it opens the tsconfig
  as a project (`createSnapshot({ openProjects: [tsconfig] })`) and calls
  `program.getDeclarationEmit`. The `--rootDir` failure that forced the
  tsc generator no longer exists.
- `@microsoft/api-extractor` has not moved: 7.59.4 still depends on
  `typescript@5.9.3` and is written against the TypeScript 5/6 JavaScript
  API. The TypeScript 7 port is tracked upstream with no maintainer
  response as of 2026-10-25; the open PR bundling TypeScript 6.0.3 is
  approved but unmerged, and the AST helpers TypeScript merged on
  2026-09-25 "required by API Extractor" are a signal, not a
  release.[^rushstack-ts7]

## Decision

- **Pin `typescript` to `7.1.0-beta` exactly** as a direct runtime
  dependency of `@savvy-web/tsdown-plugins`, not `catalog:silk` or
  `catalog:build`. Those catalogs now carry `^7.1.0-beta` themselves, but
  that is a range: this package keeps its own exact pin because it needs the
  exact compiler its declaration emit was verified on, and a prerelease has
  no caret semantics worth relying on.[^tp-manifest]
- **The two AST readers parse through one shared client.**
  `src/dts/relative-imports.ts` and `src/dts/reexport-stub.ts` call
  `withParsedSource` in `src/dts/parse.ts`, which lazily starts a single
  `API` client from `typescript/sync`, calls `createSourceFile`, and
  disposes the `RetainedSourceFile` after use. In 7.1 `forEachChild` is a
  method on the node and the `is*` guards come from
  `typescript/ast`.[^tp-parse]
- **Pin `generator: "tsgo"` with an explicit `moduleUrl`.**
  `dtsPassDtsOptions(tsconfig)` in `src/build/target-groups.ts` returns
  `{ tsconfig, emitDtsOnly: true, generator: "tsgo", tsgo: { moduleUrl:
  import.meta.resolve("typescript") } }`, shared by `deriveDtsPassOptions`
  and `deriveDeclarationsPassOptions`. The module URL is named because
  `rolldown-plugin-dts`'s auto-detection only inspects the `typescript`
  reachable from its own location, which in a consumer workspace can be a
  hoisted 7.0 stub.[^tp-target-groups] The per-pass notice "TypeScript Go
  is experimental. Some options will be unavailable." is routed to the
  collector's `suppressed` bucket as `TSGO_EXPERIMENTAL`, never a
  warning.[^tp-logger]
- **API Extractor keeps its own TypeScript 6.** `src/meta/api-extractor.ts`
  no longer passes `typescriptCompilerFolder` to `Extractor.invoke`; the
  extractor resolves the TypeScript 6 the existing
  `@microsoft/api-extractor>typescript: ^6.0.3` override installs, and that
  override stays. Handing it this package's 7.1 folder would give it the
  version stub.[^tp-api-extractor]
- `tsdown` remains a declared dependency (never a peer), so its dts passes
  resolve this package's pinned TypeScript in every install topology — the
  part of the superseded decision that still stands.

The tsgo generator opens the dts-emit tsconfig as a TypeScript project, which
is why `writeDtsEmitTsconfig` now names the base canonically and restates
its file set absolutely; see
[gotchas/tsgo-project-membership.md](../gotchas/tsgo-project-membership.md).

## Alternatives rejected

- **Waiting for API Extractor to support TypeScript 7 before moving.**
  Rejected: the port has no upstream timeline, and declaration emit and the
  meta pass already read different tsconfigs, so the two compiler
  constraints can be held apart indefinitely without blocking emit on the
  slower dependency.
- **Patching API Extractor onto TypeScript 7 via pnpm
  `patchedDependencies`.** Rejected: the port is a wholesale rewrite of its
  compiler integration against the new subpath API, not a patch.
- **Relying on `rolldown-plugin-dts`'s generator auto-detection.** Rejected
  for the hoisting reason above: the detection reads the TypeScript the
  plugin itself can see, so a consumer workspace whose hoisted `typescript`
  is a 7.0 stub flips the generator silently. An explicit `moduleUrl`
  resolved from this package is the only stable choice.

## Consequences

- `catalog:silk`/`catalog:build` carry the range `^7.1.0-beta` while
  `tsdown-plugins` pins `7.1.0-beta` exactly; do not "fix" the divergence by
  switching this package to the catalog range, which would let declaration
  emit run on a compiler it was not verified on.
- The `@e2e/bundler` harness, which had pinned `typescript: "7.1.0-beta"`
  so its fixtures built against the same compiler, is retired
  (savvy-web/systems#680, done): its suites now live in
  `packages/bundler/__test__/e2e/`, and the raw-tsdown `leaf`/`leaf-escape`
  fixtures spread `dtsPassDtsOptions(tsconfig)`'s `generator` and `tsgo`
  into `dts` instead of pinning a compiler of their own — the pattern an
  escape-hatch consumer follows (see [modules/e2e.md](../modules/e2e.md)).
- The `@microsoft/api-extractor>typescript: ^6.0.3` override in
  `@savvy-web/pnpm-plugin-silk` remains load-bearing until API Extractor
  ships TypeScript 7 support; the `@typescript/native-preview` catalog
  entries, hoist pattern, and the `@savvy-web/bundler>typescript`
  `allowedVersions` rule are gone, since TypeScript 7 ships the Go compiler
  inside `typescript` itself and nothing provides TypeScript 6 to the
  bundler any more.

[^tp-manifest]: `../../packages/tsdown-plugins/package.json`
[^tp-target-groups]: `../../packages/tsdown-plugins/src/build/target-groups.ts`
[^tp-parse]: `../../packages/tsdown-plugins/src/dts/parse.ts`
[^tp-api-extractor]: `../../packages/tsdown-plugins/src/meta/api-extractor.ts`
[^tp-logger]: `../../packages/tsdown-plugins/src/report/tsdown-logger.ts`
[^ts-7-1-schedule]: <https://github.com/microsoft/TypeScript/issues/63703>
[^rushstack-ts7]: <https://github.com/microsoft/rushstack/issues/6033>
