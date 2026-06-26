---
id: packages/tsdown-plugins/api/function/collectexportnames
title: "collectExportNames — tsdown-plugins function"
summary: "Collect every name a module exports (named re-exports, namespace re-exports, and local `export` declarations). Used to test whether a barrel's re-exports are a…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# collectExportNames

Collect every name a module exports (named re-exports, namespace re-exports, and local `export` declarations). Used to test whether a barrel's re-exports are a strict subset of a base entry, so a stub re-exporting from that base resolves every symbol. Pure parsing — no I/O.

```ts
function collectExportNames(source: string, fileName?: string): ModuleExportNames;
```
