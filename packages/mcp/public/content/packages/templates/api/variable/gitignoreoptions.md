---
id: packages/templates/api/variable/gitignoreoptions
title: "GitignoreOptions — templates variable"
summary: "Options for generating a `.gitignore` file."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# GitignoreOptions

Options for generating a `.gitignore` file.

```ts
GitignoreOptions: Schema.Struct<{
  sections: Schema.optional<Schema.Struct<{
    node: Schema.optional<typeof Schema.Boolean>;
    build: Schema.optional<typeof Schema.Boolean>;
    env: Schema.optional<typeof Schema.Boolean>;
    os: Schema.optional<typeof Schema.Boolean>;
    silk: Schema.optional<typeof Schema.Boolean>;
  }>>;
  additional: Schema.optional<Schema.Array$<typeof Schema.String>>;
}>
```
