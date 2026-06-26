---
id: packages/github-action-builder/api/variable/bundlestatsschema
title: "BundleStatsSchema — github-action-builder variable"
summary: "Statistics for a single bundled entry."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BundleStatsSchema

Statistics for a single bundled entry.

```ts
BundleStatsSchema: Schema.Struct<{
  entry: typeof Schema.String; /** Bundle size in bytes. */
  size: typeof Schema.Number; /** Build duration in milliseconds. */
  duration: typeof Schema.Number; /** Output path relative to working directory. */
  outputPath: typeof Schema.String;
}>
```
