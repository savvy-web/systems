---
id: packages/github-action-builder/api/variable/validationresultschema
title: "ValidationResultSchema — github-action-builder variable"
summary: "Validation result with errors and warnings."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationResultSchema

Validation result with errors and warnings.

```ts
ValidationResultSchema: Schema.Struct<{
  valid: typeof Schema.Boolean; /** Validation errors. */
  errors: Schema.Array$<Schema.Struct<{
    code: typeof Schema.String; /** Human-readable error message. */
    message: typeof Schema.String; /** File path where error occurred. */
    file: Schema.optional<typeof Schema.String>; /** Suggestion for fixing the error. */
    suggestion: Schema.optional<typeof Schema.String>;
  }>>; /** Validation warnings. */
  warnings: Schema.Array$<Schema.Struct<{
    code: typeof Schema.String; /** Human-readable warning message. */
    message: typeof Schema.String; /** File path where warning occurred. */
    file: Schema.optional<typeof Schema.String>; /** Suggestion for addressing the warning. */
    suggestion: Schema.optional<typeof Schema.String>;
  }>>;
}>
```
