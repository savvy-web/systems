---
id: packages/github-action-builder/api/variable/persistlocalresultschema
title: "PersistLocalResultSchema — github-action-builder variable"
summary: "Result of the persist-local operation."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# PersistLocalResultSchema

Result of the persist-local operation.

```ts
PersistLocalResultSchema: Schema.Struct<{
  success: typeof Schema.Boolean; /** Number of files copied (changed or new). */
  filesCopied: typeof Schema.Number; /** Number of files skipped (unchanged). */
  filesSkipped: typeof Schema.Number; /** Whether act template files were generated. */
  actTemplateGenerated: typeof Schema.Boolean; /** Output path where files were persisted. */
  outputPath: typeof Schema.String; /** Error message if failed. */
  error: Schema.optional<typeof Schema.String>;
}>
```
