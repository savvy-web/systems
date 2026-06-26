---
id: packages/github-action-builder/api/variable/validationoptionsschema
title: "ValidationOptionsSchema — github-action-builder variable"
summary: "Schema for validation options."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationOptionsSchema

Schema for validation options.

```ts
ValidationOptionsSchema: Schema.Struct<{
  requireActionYml: Schema.optionalWith<typeof Schema.Boolean, {
    default: () => true;
  }>; /** Maximum bundle size before warning/error (e.g., "5mb", "500kb"). */
  maxBundleSize: Schema.optional<typeof Schema.String>; /** Treat warnings as errors. Auto-detects from CI when undefined. */
  strict: Schema.optional<typeof Schema.Boolean>;
}>
```
