---
id: packages/github-action-builder/api/type/validationerror
title: "ValidationError — github-action-builder type"
summary: "Union of all validation-related errors."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationError

Union of all validation-related errors.

```ts
type ValidationError = MainEntryMissing | WorkerEntryMissing | WorkerEntryInvalidName |
  EntryFileMissing | ActionYmlMissing | ActionYmlSyntaxError | ActionYmlSchemaError |
  ValidationFailed;
```
