---
id: packages/tsdown-plugins/api/function/analyzereexportbarrel
title: "analyzeReexportBarrel — tsdown-plugins function"
summary: "Analyze an entry source as a candidate pure re-export barrel: classify its re-exported names into value vs type-only and report whether it is expressible as a…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# analyzeReexportBarrel

Analyze an entry source as a candidate pure re-export barrel: classify its re-exported names into value vs type-only and report whether it is expressible as a thin stub. Pure parsing — no I/O.

```ts
function analyzeReexportBarrel(source: string, fileName?: string): ReexportBarrelAnalysis;
```
