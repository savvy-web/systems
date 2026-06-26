---
id: packages/tsdown-plugins/api/interface/reexportbarrelanalysis
title: "ReexportBarrelAnalysis — tsdown-plugins interface"
summary: "The analysis of an entry source treated as a candidate re-export barrel."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ReexportBarrelAnalysis

The analysis of an entry source treated as a candidate re-export barrel.

```ts
interface ReexportBarrelAnalysis
```

## Members

### isPureNamedReexportBarrel

```ts
readonly isPureNamedReexportBarrel: boolean;
```

True iff EVERY top-level statement is a NAMED re-export `from` another module (`export { … } from "…"` / `export type { … } from "…"`). A module that declares anything locally, re-exports a namespace (`export * as NS from`), star-re-exports (`export * from`), or has a bare `export { … }` without `from` is NOT a pure named barrel and cannot be expressed as a thin re-export stub of another entry.

### typeNames

```ts
readonly typeNames: ReadonlyArray<string>;
```

Type-only names the module re-exports (`export type { … }`), after `as` aliasing.

### valueNames

```ts
readonly valueNames: ReadonlyArray<string>;
```

Value (non-type-only) names the module re-exports, after `as` aliasing.
