---
type: Gotcha
status: draft
title: A patch-level bundler bump that adds ae-forgotten-export errors is TypeScript 7.1 emitting typeof references, not a bundler regression
description: "Since @savvy-web/tsdown-plugins 2.11.0 declarations come from TypeScript 7.1 (tsgo), which emits any exported member whose value is a bare reference to a non-exported module-level binding (a class static such as static readonly x = x, an object-literal property, or a member of an Object.assign statics object) as a typeof reference to that binding where TypeScript 6 inlined its signature; API Extractor then reports ae-forgotten-export for each one with no source change. The fix is in the consumer's source, site by site (inline, static method, or annotation), not the build pipeline."
resource: ../../packages/tsdown-plugins/src/build/target-groups.ts
tags: [build, compat]
stale_after: 2027-04-25T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-25T19:42:04Z
sources:
  - id: tp-target-groups
    resource: ../../packages/tsdown-plugins/src/build/target-groups.ts
  - id: issue-824
    resource: https://github.com/savvy-web/systems/issues/824
integrity:
  generated:
    body: 7c62f773b9d87e57
---

# A patch-level bundler bump that adds ae-forgotten-export errors is TypeScript 7.1 emitting typeof references, not a bundler regression

## What you see

After a routine `@savvy-web/bundler` / `@savvy-web/tsdown-plugins` bump
(tsdown-plugins 2.11.0 or later), a package whose source did not change
fails its prod build in CI with `ae-forgotten-export`, one per value
referenced from an exported object literal. The typical shape is a
handler map whose properties are imported functions the entry point does
not export:

```ts
import { handleTestStatus } from "./handlers/test-status.js";

export const toolHandlers = { test_status: handleTestStatus };
```

The API Extractor surface grew, and the only change was the build
tooling.[^issue-824]

## What you will wrongly conclude

That the bundler or tsdown-plugins regressed — a broken rollup, a lost
re-export, a changed API Extractor configuration — and that the fix
belongs in the build pipeline or in a downgrade.

## What is actually true

The declarations are now emitted by TypeScript 7.1's compiler (the tsgo
generator, see
[decisions/typescript-7-1-dts-api.md](../decisions/typescript-7-1-dts-api.md)),
not TypeScript 6's `tsc`, and the two emit this case
differently:[^tp-target-groups]

- TypeScript 6 inlined the property's signature:
  `test_status: (input: In) => Promise<number>`.
- TypeScript 7.1 emits `test_status: typeof handleTestStatus` and adds a
  non-exported `declare const handleTestStatus` to the rollup.

API Extractor sees an exported declaration referencing a symbol the entry
point does not export, and reports `ae-forgotten-export`, which is
CI-fatal. This was reproduced with a two-file fixture under both
compilers, and no compiler option restores the inlined form, so nothing
in the pipeline can or should paper over it.[^issue-824]

## What to do

Fix it in the consumer's source, one site at a time. The trigger is any
exported member whose value is a bare reference to a non-exported
module-level binding: a class static, an object-literal property (the
`toolHandlers` case in #824), or a member of an
`Object.assign(schema, { … })` statics object. A TypeScript 7.1 probe
shows which source forms emit a `typeof` reference:

| Source form | TS 7.1 declaration | API Extractor |
| --- | --- | --- |
| `static readonly a = viaConst` (const delegate) | `a: typeof viaConst` + non-exported `declare const viaConst` | forgotten export |
| `static readonly b = viaFunction` (function delegate) | `b: typeof viaFunction` | forgotten export |
| `static readonly c = (x: number): string => …` (inline) | `c: (x: number) => string` | clean |
| `static readonly d: (x: number) => string = viaConst` (annotated) | `d: (x: number) => string` | clean |
| `static f(x: number): string { … }` (static method) | `static f(x: number): string` | clean |

Fix each site with the first of these that fits:

1. **Inline the body** at the member when it is self-contained.
2. **Otherwise make it a static method.** This is safe when the body does
   not use `this`, so passing `X.f` as a callback keeps working.
3. **Annotate the member's type** only where the module-level binding has
   to stay, for example because other module code calls it before the
   class is defined. The annotation duplicates the signature, so it is the
   exception.

Do not export the locals from the entry point just to silence the warning:
that grows the public surface. Do not suppress `ae-forgotten-export`
either. The warning flags a real docs regression: the API model and the
rendered docs show `typeof viaConst` instead of a signature, which defeats
the class-static convention of keeping a symbol's docs in one place on the
class. A `suppressWarnings` entry is at most a temporary stopgap while the
sites are refactored.

The `@effected` kit hit this at scale, about 174 sites across 12 packages,
mostly `static readonly x = x` delegates, and is refactoring them by this
rule as part of the systems⇄effected sync-facades work.

[^tp-target-groups]: `../../packages/tsdown-plugins/src/build/target-groups.ts`
[^issue-824]: <https://github.com/savvy-web/systems/issues/824>
