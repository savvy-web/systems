---
type: Interface
title: bundler tsconfig preset
description: "The self-contained TypeScript base every plain Node library package extends, and the rule that keeps every shipped preset in the suite free of extends chains."
status: draft
kind: config
resource: ../../packages/bundler/public/tsconfig/ecma.json
tags: [build]
sources:
  - id: tsconfig-preset-doc
    resource: ../../packages/bundler/public/tsconfig/ecma.json
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: a0e26243358f467afcf6b6bd9344d315f606a644eefd50dfd2a36686991053e1
---

# bundler tsconfig preset

## What a consumer can rely on

`@savvy-web/bundler/tsconfig/ecma.json` is the canonical build base for a
plain Node library package in this suite: `target: es2025`, `nodenext`,
`strict`, `verbatimModuleSyntax`, `isolatedModules`, declaration emit. A
consumer extends it once, by package specifier, and gets exactly the
TypeScript configuration the bundler's build assumes.[^tsconfig-preset-doc]

- **Build tools own the lib/build base; silk owns the convention roots
  and framework configs.** `@savvy-web/bundler` ships `ecma.json` for a
  plain Node library, `@savvy-web/rspress-builder` ships
  `tsconfig/plugin.json` for an RSPress plugin, and
  `@savvy-web/github-action-builder` ships `tsconfig/action.json` for a
  GitHub Action — each build tool ships exactly the preset its own
  package type needs.[^tsconfig-preset-doc]
- **A shipped preset is self-contained: it extends only relative files
  inside its own package, and in practice none of the shipped presets
  uses `extends` at all.** Two independent reasons hold this rule, and
  both are load-bearing rather than stylistic:
  - a consumer may carry the build tool only as a *transitive*
    dependency, and the tsconfig-`extends` loader tsdown uses resolves
    package specifiers from the project root — it cannot reach a
    transitive dependency's preset. A preset another package's presets
    must chain through (like `rspress-builder`'s) instead keeps a
    byte-identical copy of the base, guarded by its own sync test.
  - TypeScript's `extends` REPLACES array-valued compiler options
    (`types`, `lib`) rather than merging them, so a consumer overriding
    either loses every entry the base declared — `node` included, which
    silently takes `console`/`process`/`Buffer` with it. Chaining a
    preset's own `extends` compounds this risk on every hop, which is
    why the presets stay fully inlined even within the same
    package.[^tsconfig-preset-doc]
- **Every shipped preset sets `composite: false`** (nothing in the repo
  uses project references, and `composite: true` produced a spurious
  consumer warning) **and includes `types/*.d.ts` rather than
  `types/*.ts`** — a `types/` directory holds ambient declarations, not
  compilable source.[^tsconfig-preset-doc]
- **The TS6 baseline a consumer inherits:** `types` set explicitly (TS6's
  own default is `[]`), `module` values of `nodenext`/`node20`/`esnext`
  rather than the deprecated `node`/`node10`, and no redundant
  `dom.iterable` (subsumed by `dom`).[^tsconfig-preset-doc]
- **The bundler and `tsdown-plugins` themselves extend the base by
  relative path, never by package specifier** — a package-before-typecheck
  cycle would otherwise exist, since the specifier only resolves once the
  `public/` copy has landed in `dist`. A downstream consumer always
  extends by package specifier; the relative-path form is specific to the
  two packages upstream of the published copy.[^tsconfig-preset-doc]

## Related

- [modules/bundler.md](../modules/bundler.md) — the module that ships
  this preset.
- [decisions/typescript-6-dts-pin.md](../decisions/typescript-6-dts-pin.md)
  — the TypeScript 6 pin this preset's baseline assumes.

[^tsconfig-preset-doc]: `../../packages/bundler/public/tsconfig/ecma.json`
