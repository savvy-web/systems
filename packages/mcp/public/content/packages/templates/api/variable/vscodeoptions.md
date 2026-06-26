---
id: packages/templates/api/variable/vscodeoptions
title: "VsCodeOptions — templates variable"
summary: "Options for generating VS Code configuration files."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# VsCodeOptions

Options for generating VS Code configuration files.

```ts
VsCodeOptions: Schema.Struct<{
  settings: Schema.optional<Schema.Struct<{
    biome: Schema.optional<typeof Schema.Boolean>;
    turbo: Schema.optional<typeof Schema.Boolean>;
    vitest: Schema.optional<typeof Schema.Boolean>;
  }>>;
  extensions: Schema.optional<Schema.Array$<typeof Schema.String>>;
}>
```
