---
id: packages/github-action-builder/api/variable/loadconfigoptionsschema
title: "LoadConfigOptionsSchema — github-action-builder variable"
summary: "Options for loading configuration."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# LoadConfigOptionsSchema

Options for loading configuration.

```ts
LoadConfigOptionsSchema: Schema.Struct<{
  cwd: Schema.optional<Schema.transform<Schema.Union<[typeof Schema.String, Schema.instanceOf<Buffer<ArrayBufferLike>>, Schema.instanceOf<URL>]>, typeof Schema.String>>; /** Explicit path to config file. Accepts string, Buffer, or URL. */
  configPath: Schema.optional<Schema.transform<Schema.Union<[typeof Schema.String, Schema.instanceOf<Buffer<ArrayBufferLike>>, Schema.instanceOf<URL>]>, typeof Schema.String>>;
}>
```
