---
type: Gotcha
status: draft
title: A patch-level bundler bump that adds ae-forgotten-export errors is TypeScript 7.1 emitting typeof references, not a bundler regression
description: "Since @savvy-web/tsdown-plugins 2.11.0 declarations come from TypeScript 7.1 (tsgo), which emits an exported object literal's imported, non-exported property values as typeof references to non-exported locals where TypeScript 6 inlined their signatures; API Extractor then reports ae-forgotten-export for each one with no source change. The fix is in the consumer's source, not the build pipeline."
resource: ../../packages/tsdown-plugins/src/build/target-groups.ts
tags: [build, compat]
stale_after: 2027-04-25T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-25T19:39:30Z
sources:
  - id: tp-target-groups
    resource: ../../packages/tsdown-plugins/src/build/target-groups.ts
  - id: issue-824
    resource: https://github.com/savvy-web/systems/issues/824
integrity:
  generated:
    body: 82783853a00a71ca
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

Fix it in the consumer's source:

- **Export the referenced symbols from the entry point**, each with a
  release tag, so the `typeof` reference resolves to part of the public
  surface; or
- **Give the object an explicit type annotation** (for example a named,
  exported handler-map type), so the emitted declaration names that type
  instead of referencing the locals.

Suppressing `ae-forgotten-export` in the package's `suppressWarnings` is a
stopgap only: it hides a real hole in the documented surface rather than
closing it.

[^tp-target-groups]: `../../packages/tsdown-plugins/src/build/target-groups.ts`
[^issue-824]: <https://github.com/savvy-web/systems/issues/824>
