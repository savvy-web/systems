---
id: packages/tsdown-plugins/api/function/copyambientdts
title: "copyAmbientDts — tsdown-plugins function"
summary: "Copy each ambient `.d.ts` export's source verbatim into `outDir/<outName>`, byte-stable (an unchanged file keeps its timestamp). The copy is NOT compiled or bu…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# copyAmbientDts

Copy each ambient `.d.ts` export's source verbatim into `outDir/<outName>`, byte-stable (an unchanged file keeps its timestamp). The copy is NOT compiled or bundled, so the build owns two fast-fail checks: the source must exist, and it must be self-contained — a relative import/export/reference would not resolve once the file is flattened to the package root. Throws [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) on a missing source or any relative specifier.

```ts
function copyAmbientDts(options: CopyAmbientDtsOptions): void;
```
