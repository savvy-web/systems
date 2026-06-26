---
id: packages/github-action-builder/api/class/validationfailed
title: "ValidationFailed — github-action-builder class"
summary: "Error when validation fails in strict mode (CI environment)."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationFailed

Error when validation fails in strict mode (CI environment).

```ts
class ValidationFailed extends ValidationFailedBase<{
  readonly errorCount: number;
  readonly warningCount: number;
  readonly message: string;
}>
```

## Members

### errorCount

```ts
readonly errorCount: number;
```

Number of errors encountered.

### message

```ts
readonly message: string;
```

Formatted validation result message.

### warningCount

```ts
readonly warningCount: number;
```

Number of warnings encountered.
