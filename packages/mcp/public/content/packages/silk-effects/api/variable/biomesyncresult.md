---
id: packages/silk-effects/api/variable/biomesyncresult
title: "BiomeSyncResult — silk-effects variable"
summary: "Result of a Biome schema URL sync or check operation."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# BiomeSyncResult

Result of a Biome schema URL sync or check operation.

```ts
BiomeSyncResult: Schema.Struct<{
  updated: Schema.Array$<typeof Schema.String>;
  skipped: Schema.Array$<typeof Schema.String>;
  current: Schema.Array$<typeof Schema.String>;
}>
```
