---
id: packages/github-action-builder/api/variable/detectedentryschema
title: "DetectedEntrySchema — github-action-builder variable"
summary: "Detected entry point information."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# DetectedEntrySchema

Detected entry point information.

```ts
DetectedEntrySchema: Schema.Struct<{
  type: typeof Schema.String; /** Absolute path to the entry file. */
  path: typeof Schema.String; /** Output path for the bundled file. */
  output: typeof Schema.String;
}>
```
