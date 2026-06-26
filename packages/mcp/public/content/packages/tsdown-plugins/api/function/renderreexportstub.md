---
id: packages/tsdown-plugins/api/function/renderreexportstub
title: "renderReexportStub — tsdown-plugins function"
summary: "Render a thin re-export-stub `.d.ts`/`.d.cts` body: named re-exports of `valueNames` and `typeNames` from `baseSpecifier` (the published file of the base entry…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# renderReexportStub

Render a thin re-export-stub `.d.ts`/`.d.cts` body: named re-exports of `valueNames` and `typeNames` from `baseSpecifier` (the published file of the base entry, e.g. `./index.js` for the ESM `.d.ts` or `./index.cjs` for the CJS `.d.cts`). Names are sorted so the output is deterministic. Returns the empty string when there is nothing to re-export.

```ts
function renderReexportStub(options: {
  readonly valueNames: ReadonlyArray<string>;
  readonly typeNames: ReadonlyArray<string>;
  readonly baseSpecifier: string;
}): string;
```
