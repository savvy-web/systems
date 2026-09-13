---
type: Decision
title: Pin typescript to ^6.0.3 in tsdown-plugins for declaration emission
description: "@savvy-web/tsdown-plugins pins typescript ^6.0.3 directly (not catalog:silk) and forces dts.generator: tsc, because TypeScript >=7 has no stable compiler API until 7.1 and flips rolldown-plugin-dts to a generator that breaks emit."
status: draft
tags: [build]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: e8e2ee0ceb4bd0b1e0e68e0f7f4aab1f0f937fab65057a338c011fd0ed0d395a
sources:
  - id: dts-emission
    resource: ../../packages/tsdown-plugins/package.json
  - id: tsconfig-preset
    resource: ../../packages/bundler/public/tsconfig/ecma.json
---

# Pin typescript to ^6.0.3 in tsdown-plugins for declaration emission

## Context

The workspace-wide `catalog:silk` catalog is on TypeScript 7, but
`@savvy-web/tsdown-plugins`' declaration-emission pass drives the
TypeScript compiler directly at runtime (the two AST readers in
`src/dts/`) via `rolldown-plugin-dts`'s tsc fallback path (see the
`isolatedDeclarations` rejection in
[modules/tsdown-plugins.md](../modules/tsdown-plugins.md)). Two
independent facts about TypeScript 7 collide with that:

- TypeScript 7.0 ships no stable compiler API — a version-stub main
  export — until 7.1, and the dts pass's AST readers depend on that API
  existing at runtime.
- `rolldown-plugin-dts` auto-selects its emit generator from the
  peer-resolved TypeScript major: at major ≥ 7 it picks its native
  "tsgo" generator, which spawns the compiler with
  `--rootDir dirname(tsconfig)`. Because the dts tsconfig this package
  writes lives in the OS temp dir, that rootDir resolves to the temp
  dir, and emit fails with `TS6059` while declarations leak into the
  package's own `src/`.

## Decision

Pin `typescript` to `^6.0.3` as a direct runtime dependency of
`@savvy-web/tsdown-plugins` — not sourced from `catalog:silk` — and hold
the line with two independent fixes rather than the pin alone:

- `deriveDtsPassOptions`/`deriveDeclarationsPassOptions` pin
  `dts.generator: "tsc"` explicitly, so `rolldown-plugin-dts`'s
  major-based auto-detection can never fire regardless of which
  TypeScript version tsdown ends up resolving.
- `tsdown` itself is a declared dependency of `tsdown-plugins` (never an
  undeclared devDependency or a peer), so its two `import("tsdown")`
  seams resolve `tsdown` — and therefore its declaration passes — against
  `tsdown-plugins`' own pinned TypeScript in every install topology: the
  front door, both self-hosting escape-hatch builders, and a raw-tsdown
  escape-hatch consumer alike. None of them can be poisoned by a
  host-hoisted `tsdown` peered against the consumer workspace's
  TypeScript 7.

The shipped tsconfig presets (`@savvy-web/bundler/tsconfig/ecma.json` and
siblings) independently target a TypeScript 6 baseline — explicit `types`
(TS6's default is `[]`), `module: nodenext`/`node20`/`esnext` rather than
the deprecated `node`/`node10` values, and no redundant `dom.iterable`
(subsumed by `dom`) — so a consumer extending the shipped base is not
silently relying on TypeScript 7 compiler-option defaults either.

Consumer fix, once these are in place: the `typescript` runtime dependency
plus the `dts.generator: "tsc"` pin, together, not one alone — the
generator pin without the dependency pin still risks resolving `tsc`
against a TypeScript 7 compiler that has no stable API to drive.

## Alternatives rejected

- **Following `catalog:silk`'s TypeScript 7 pin in `tsdown-plugins` too.**
  Rejected: TypeScript 7.0 has no stable compiler API until 7.1, so the
  package's own AST readers would have nothing to drive, independent of
  the generator-selection problem.
- **Relying on generator auto-detection.** Rejected:
  `rolldown-plugin-dts` selects "tsgo" once it sees TypeScript ≥ 7 on the
  peer-resolved version, regardless of whether the caller wants the tsc
  path — auto-detection is a property of the *resolved* TypeScript
  version, not a stable per-package choice, so it can flip silently on an
  unrelated dependency bump elsewhere in the graph.
- **Fixing only the generator (`dts.generator: "tsc"`) without pinning
  `typescript` directly.** Rejected: forcing the tsc generator against a
  TypeScript 7 compiler with no stable API would still fail — the
  generator pin and the dependency pin are both required, and each
  addresses a different one of the two independent problems above.

## Consequences

- Declaration emission across the Silk Suite stays on a TypeScript 6
  compiler even as the rest of the workspace catalog moves to 7, which is
  a deliberate divergence a reader must not "fix" by moving `typescript`
  back to `catalog:silk`.
- The pin must be revisited at TypeScript 7.1, once a stable compiler API
  exists — not before.
- `@microsoft/api-extractor` independently pins TypeScript ~5.9 and hard-
  errors on the unknown `stableTypeOrdering` compiler option, which is why
  that flag lives in a sibling temp tsconfig used only by the dts and
  declarations emit passes, never by the meta (API Extractor) pass — the
  two compiler-version constraints in this package do not converge on one
  tsconfig.
- Any downstream package or escape-hatch consumer following the same dts
  path inherits the same constraint: it must pin `typescript` and force
  `dts.generator: "tsc"` together, not rely on `tsdown-plugins`' pin
  alone if it resolves its own `tsdown`.
