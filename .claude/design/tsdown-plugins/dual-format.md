---
status: current
module: tsdown-plugins
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ./build-loop.md
  - ./entry-and-manifest.md
  - ./report.md
  - ../silk/architecture.md
---

# Dual-format output

What changes when `cjs` joins the build format, and the two rolldown plugins that make the emitted `.cjs` actually work for `require()` consumers. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [What cjs changes](#what-cjs-changes)
- [The cjs-default-interop plugin](#the-cjs-default-interop-plugin)
- [The node-builtin default-interop plugin](#the-node-builtin-default-interop-plugin)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

The output format is a `BuildFormat` array (`"esm" | "cjs"`, default `["esm"]`). Everything cjs-specific — the second output, the `cjsDefault` interop, the manifest `require` condition, the two interop plugins — is gated on `format.includes("cjs")` and defaults off, so an esm-only build is byte-identical to a build with no cjs capability at all. The driver is silk's `./changesets/markdownlint` entry, which markdownlint-cli2 loads by `require()`/`import()`; see `../silk/architecture.md`.

## Current state

- **Format plumbing:** `BuildFormat` and the `format` option in `src/build/target-groups.ts`; the `dual`/`DualExports` thread from `buildTargetGroups` through `emitManifest` into `transformExports` (`src/manifest/transform.ts`).
- **Plugins:** `cjsDefaultInterop` (`src/build/cjs-default-interop.ts`) and `nodeBuiltinDefaultInterop` (`src/build/node-builtin-default-interop.ts`), attached by `buildTargetGroups`.

## What cjs changes

- **Output.** tsdown emits `index.js` plus `index.cjs` (and `index.d.ts` plus `index.d.cts`). `fixedExtension` stays `false`: for a `type: module` package that already yields the `.js`/`.cjs` scheme with no collision, while `true` would wrongly produce `.mjs`. The `fixedExtension` TSDoc in `src/build/target-groups.ts` holds the finding.
- **Interop.** `cjsDefault: true` (rolldown `output.exports: "auto"`) is set only when cjs is present, so `require()` returns the value and named exports survive.
- **Manifest.** Each dual TS export gains a `require` condition alongside `types`/`import`. `DualExports` is a boolean or a set of export keys, so per-entry overrides can make some exports dual and leave the rest import-only. See [Entry detection and manifest emission](./entry-and-manifest.md#manifest-emission).
- **Both passes carry the interop plugins.** tsdown's dts pass re-emits the `.cjs` JS chunk and overwrites the JS pass's output, so `buildTargetGroups` attaches fresh plugin instances to every per-entry dts build as well as the JS pass — otherwise the final `.cjs` would lose the footer. A cjs loose file gets the same wiring.

## The cjs-default-interop plugin

`cjsDefaultInterop` is a `renderChunk` plugin that appends a footer to a cjs *entry* chunk exporting a `default` alongside named exports, reassigning `module.exports` to the default value and re-attaching the named exports as its own properties.

- **Why.** rolldown cannot natively emit `module.exports = <default>` while keeping named exports: for a default+named module both `"auto"` and `"named"` emit `exports.default = <default>`, so an ESM consumer doing `(await import(x)).default` receives the `{ default, ...named }` wrapper rather than the default value. markdownlint-cli2 reads `module.default` expecting the rules array and aborts on the wrapper.
- **Gating.** cjs only; entry chunks only (a shared chunk's `module.exports` is read by other chunks via named bindings); only when the chunk has both a `default` and at least one named export. The footer is additionally self-guarded at runtime, and a primitive default is left alone with a one-line `console.warn` so the no-op is observable.

## The node-builtin default-interop plugin

`nodeBuiltinDefaultInterop` fixes a rolldown cjs-codegen defect: for a default import of an external node builtin, rolldown emits a bare `require("node:x")` without its `__toESM` wrapper yet still accesses `.default`, which is `undefined` on a builtin's CJS export object. The concrete victim was vfile's `export { default as minproc } from 'node:process'` bundled into silk's `.cjs`, which crashed `savvy changeset version`.

- **It is a `transform` plugin.** It rewrites the default import/re-export of a node builtin into the namespace form before codegen (`import x from "node:x"` → `import * as x from "node:x"`, likewise for re-exports and the default+named combined form). rolldown wraps a namespace import correctly, so member access works.
- **Why on the source.** rolldown exposes no Rollup-style `output.interop` knob at the output layer, and rewriting before codegen is immune to minification and identical for per-module and bundled output.
- **Matching** is statement-anchored regexes gated on a `node:` prefix or a bare `builtinModules` name; cjs-only, a no-op for esm.

## Boundaries and invariants

- **Dual-format is derived from one source**: everything cjs is gated on `format.includes("cjs")` and defaults off; esm-only builds stay byte-identical.
- **`fixedExtension` is the `false` literal** and does not change for dual format.
- **Both interop plugins run in every pass that emits a `.cjs`** — the JS pass, each per-entry dts build and cjs loose files — with fresh instances per build.
- **`cjsDefaultInterop` is gated to cjs default+named entry chunks**; `nodeBuiltinDefaultInterop` is cjs-only and rewrites only node-builtin default imports.
- **Warning suppression for the `MIXED_EXPORTS` these passes trigger lives in the report seams, not in tsdown config.** See [The build report](./report.md#the-capture-seams).

## Rationale

### Why two plugins instead of a rolldown option

Neither problem has an upstream knob. rolldown's `output.exports` cannot express "default is the module, named exports hang off it", and it has no `output.interop`. Both fixes are therefore local: one at the chunk footer, one on the source before codegen. Each is narrowly gated so it is a provable no-op for every chunk it does not target, which is what lets them run unconditionally in every cjs-emitting pass.
