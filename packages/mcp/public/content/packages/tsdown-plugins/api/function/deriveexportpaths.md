---
id: packages/tsdown-plugins/api/function/deriveexportpaths
title: "deriveExportPaths — tsdown-plugins function"
summary: "Map entry names to export paths using the package exports map. index maps to \".\"."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# deriveExportPaths

Map entry names to export paths using the package exports map. index maps to ".".

```ts
function deriveExportPaths(entries: Record<string, string>, exportsMap: Record<string, string> | undefined): Record<string, string>;
```
