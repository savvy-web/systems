---
id: packages/tsdown-plugins/api/type/loosefiles
title: "LooseFiles — tsdown-plugins type"
summary: "Map of literal output filename to its source (bare string) or a `{ source, format }` spec."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# LooseFiles

Map of literal output filename to its source (bare string) or a `{ source, format }` spec.

```ts
type LooseFiles = Record<string, string | LooseFileSpec>;
```
