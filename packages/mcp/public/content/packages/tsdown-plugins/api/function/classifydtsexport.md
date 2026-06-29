---
id: packages/tsdown-plugins/api/function/classifydtsexport
title: "classifyDtsExport — tsdown-plugins function"
summary: "Classify an export value: - `ambient` — a types-only declaration source (bare `.d.ts` string, or `{ types: \"*.d.ts\" }` with no runtime source). - `mixed` — a d…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# classifyDtsExport

Classify an export value: - `ambient` — a types-only declaration source (bare `.d.ts` string, or `{ types: "*.d.ts" }` with no runtime source). - `mixed` — a declaration `types` AND a compilable runtime source (`import`/`require`/`default` → `.ts`/`.tsx`). - `none` — anything else (normal runtime export, json, etc.).

```ts
function classifyDtsExport(value: unknown): DtsExportClass;
```
