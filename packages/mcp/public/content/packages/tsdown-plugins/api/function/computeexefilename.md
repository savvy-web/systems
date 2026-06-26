---
id: packages/tsdown-plugins/api/function/computeexefilename
title: "computeExeFileName — tsdown-plugins function"
summary: "The exact filename `@tsdown/exe` emits for a SEA target, mirroring tsdown's `resolveOutputFileName`: base fileName + `-<platform>-<arch>` + `.exe` on win. Sing…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# computeExeFileName

The exact filename `@tsdown/exe` emits for a SEA target, mirroring tsdown's `resolveOutputFileName`: base fileName + `-<platform>-<arch>` + `.exe` on win. Single source of truth so the manifest value never drifts from the on-disk file.

```ts
function computeExeFileName(fileName: string, target: ExeTarget): string;
```
