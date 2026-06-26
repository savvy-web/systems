---
id: packages/github-action-builder/api/variable/validationerrorschema
title: "ValidationErrorSchema — github-action-builder variable"
summary: "A validation error item."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationErrorSchema

A validation error item.

```ts
ValidationErrorSchema: Schema.Struct<{
  code: typeof Schema.String; /** Human-readable error message. */
  message: typeof Schema.String; /** File path where error occurred. */
  file: Schema.optional<typeof Schema.String>; /** Suggestion for fixing the error. */
  suggestion: Schema.optional<typeof Schema.String>;
}>
```
