---
id: packages/github-action-builder/api/variable/configinputschema
title: "ConfigInputSchema — github-action-builder variable"
summary: "User-provided configuration input (all fields optional)."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigInputSchema

User-provided configuration input (all fields optional).

```ts
ConfigInputSchema: Schema.Struct<{
  entries: Schema.optional<Schema.Struct<{
    main: Schema.optional<typeof Schema.String>;
    pre: Schema.optional<typeof Schema.String>;
    post: Schema.optional<typeof Schema.String>;
    workers: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
  }>>;
  build: Schema.optional<Schema.Struct<{
    minify: Schema.optional<typeof Schema.Boolean>;
    sourceMap: Schema.optional<typeof Schema.Boolean>;
    externals: Schema.optional<Schema.Array$<typeof Schema.String>>;
    ignore: Schema.optional<Schema.Array$<typeof Schema.String>>;
  }>>;
  validation: Schema.optional<Schema.Struct<{
    requireActionYml: Schema.optional<typeof Schema.Boolean>;
    maxBundleSize: Schema.optional<typeof Schema.String>;
    strict: Schema.optional<typeof Schema.Boolean>;
  }>>;
  persistLocal: Schema.optional<Schema.Struct<{
    enabled: Schema.optional<typeof Schema.Boolean>;
    path: Schema.optional<typeof Schema.String>;
    actTemplate: Schema.optional<typeof Schema.Boolean>;
  }>>;
}>
```
