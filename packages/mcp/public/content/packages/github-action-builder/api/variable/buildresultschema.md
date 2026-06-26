---
id: packages/github-action-builder/api/variable/buildresultschema
title: "BuildResultSchema — github-action-builder variable"
summary: "Result of the complete build process."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BuildResultSchema

Result of the complete build process.

```ts
BuildResultSchema: Schema.Struct<{
  success: typeof Schema.Boolean; /** Results for each entry that was built. */
  entries: Schema.Array$<Schema.Struct<{
    success: typeof Schema.Boolean; /** Bundle statistics if successful. */
    stats: Schema.optional<Schema.Struct<{
      entry: typeof Schema.String; /** Bundle size in bytes. */
      size: typeof Schema.Number; /** Build duration in milliseconds. */
      duration: typeof Schema.Number; /** Output path relative to working directory. */
      outputPath: typeof Schema.String;
    }>>; /** Error message if failed. */
    error: Schema.optional<typeof Schema.String>;
  }>>; /** Total build duration in milliseconds. */
  duration: typeof Schema.Number; /** Error message if build failed. */
  error: Schema.optional<typeof Schema.String>;
}>
```
