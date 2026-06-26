---
id: packages/github-action-builder/api/variable/validationwarningschema
title: "ValidationWarningSchema — github-action-builder variable"
summary: "A validation warning."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationWarningSchema

A validation warning.

```ts
ValidationWarningSchema: Schema.Struct<{
  code: typeof Schema.String; /** Human-readable warning message. */
  message: typeof Schema.String; /** File path where warning occurred. */
  file: Schema.optional<typeof Schema.String>; /** Suggestion for addressing the warning. */
  suggestion: Schema.optional<typeof Schema.String>;
}>
```
