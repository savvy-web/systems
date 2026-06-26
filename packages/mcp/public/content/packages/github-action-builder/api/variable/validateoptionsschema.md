---
id: packages/github-action-builder/api/variable/validateoptionsschema
title: "ValidateOptionsSchema — github-action-builder variable"
summary: "Options for validation."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidateOptionsSchema

Options for validation.

```ts
ValidateOptionsSchema: Schema.Struct<{
  cwd: Schema.optional<Schema.transform<Schema.Union<[typeof Schema.String, Schema.instanceOf<Buffer<ArrayBufferLike>>, Schema.instanceOf<URL>]>, typeof Schema.String>>; /** Force strict mode regardless of environment. Auto-detects from CI when undefined. */
  strict: Schema.optional<typeof Schema.Boolean>;
}>
```
