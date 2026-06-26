---
id: packages/github-action-builder/api/variable/detectentriesresultschema
title: "DetectEntriesResultSchema — github-action-builder variable"
summary: "Result of entry detection."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# DetectEntriesResultSchema

Result of entry detection.

```ts
DetectEntriesResultSchema: Schema.Struct<{
  success: typeof Schema.Boolean; /** Detected entries. */
  entries: Schema.Array$<Schema.Struct<{
    type: typeof Schema.String; /** Absolute path to the entry file. */
    path: typeof Schema.String; /** Output path for the bundled file. */
    output: typeof Schema.String;
  }>>;
}>
```
