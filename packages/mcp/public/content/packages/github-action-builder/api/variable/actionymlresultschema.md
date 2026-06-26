---
id: packages/github-action-builder/api/variable/actionymlresultschema
title: "ActionYmlResultSchema — github-action-builder variable"
summary: "Result of action.yml validation."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlResultSchema

Result of action.yml validation.

```ts
ActionYmlResultSchema: Schema.Struct<{
  valid: typeof Schema.Boolean; /** Parsed action.yml content if valid. */
  content: Schema.optional<typeof Schema.Any>; /** Validation errors. */
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
