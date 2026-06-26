---
id: packages/github-action-builder/api/variable/bundleresultschema
title: "BundleResultSchema — github-action-builder variable"
summary: "Result of bundling a single entry."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BundleResultSchema

Result of bundling a single entry.

```ts
BundleResultSchema: Schema.Struct<{
  success: typeof Schema.Boolean; /** Bundle statistics if successful. */
  stats: Schema.optional<Schema.Struct<{
    entry: typeof Schema.String; /** Bundle size in bytes. */
    size: typeof Schema.Number; /** Build duration in milliseconds. */
    duration: typeof Schema.Number; /** Output path relative to working directory. */
    outputPath: typeof Schema.String;
  }>>; /** Error message if failed. */
  error: Schema.optional<typeof Schema.String>;
}>
```
