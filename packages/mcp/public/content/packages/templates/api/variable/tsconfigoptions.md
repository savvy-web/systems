---
id: packages/templates/api/variable/tsconfigoptions
title: "TsConfigOptions — templates variable"
summary: "Options for generating a `tsconfig.json` file."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# TsConfigOptions

Options for generating a `tsconfig.json` file.

```ts
TsConfigOptions: Schema.Struct<{
  extends: Schema.optional<Schema.Union<[typeof Schema.String, Schema.Array$<typeof Schema.String>]>>;
  composite: Schema.optional<typeof Schema.Boolean>;
  include: Schema.optional<Schema.Array$<typeof Schema.String>>;
  exclude: Schema.optional<Schema.Array$<typeof Schema.String>>;
  references: Schema.optional<Schema.Array$<Schema.Struct<{
    path: typeof Schema.String;
  }>>>;
}>
```
