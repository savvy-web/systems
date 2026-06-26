---
id: packages/silk-effects/api/variable/biomesyncoptions
title: "BiomeSyncOptions — silk-effects variable"
summary: "Options for BiomeSchemaSync operations."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# BiomeSyncOptions

Options for [BiomeSchemaSync](silk://packages/silk-effects/api/class/biomeschemasync) operations.

```ts
BiomeSyncOptions: Schema.Struct<{
  cwd: Schema.optional<typeof Schema.String>;
  gitignore: Schema.optionalWith<typeof Schema.Boolean, {
    default: () => true;
  }>;
}>
```
