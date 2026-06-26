---
id: packages/github-action-builder/api/variable/entriesschema
title: "EntriesSchema — github-action-builder variable"
summary: "Schema for entry point paths."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# EntriesSchema

Schema for entry point paths.

```ts
EntriesSchema: Schema.Struct<{
  main: Schema.optionalWith<typeof Schema.String, {
    default: () => string;
  }>; /** Path to the pre-action hook entry point. */
  pre: Schema.optional<typeof Schema.String>; /** Path to the post-action hook entry point. */
  post: Schema.optional<typeof Schema.String>; /** Extra non-lifecycle worker bundles (name -> source path), each emitted as dist/<name>.js. */
  workers: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
}>
```
