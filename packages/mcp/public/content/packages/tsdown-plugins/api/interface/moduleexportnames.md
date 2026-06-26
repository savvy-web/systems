---
id: packages/tsdown-plugins/api/interface/moduleexportnames
title: "ModuleExportNames — tsdown-plugins interface"
summary: "The set of names a module exports, plus whether that set is fully known."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ModuleExportNames

The set of names a module exports, plus whether that set is fully known.

```ts
interface ModuleExportNames
```

## Members

### complete

```ts
readonly complete: boolean;
```

False when the module contains a star re-export (`export * from "…"`) whose target exports cannot be enumerated from this source alone — the name set is then a lower bound, not complete, so callers must not use it for a strict subset decision.

### names

```ts
readonly names: ReadonlySet<string>;
```
