---
id: packages/templates/api/variable/biomeoptions
title: "BiomeOptions — templates variable"
summary: "Options for generating a Biome configuration file."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# BiomeOptions

Options for generating a Biome configuration file.

```ts
BiomeOptions: Schema.Struct<{
  version: typeof Schema.String;
  extends: Schema.optional<Schema.Array$<typeof Schema.String>>;
  root: Schema.optional<typeof Schema.Boolean>;
}>
```
