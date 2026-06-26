---
id: packages/github-action-builder/api/class/cleanerror
title: "CleanError — github-action-builder class"
summary: "Error when cleaning the output directory fails."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# CleanError

Error when cleaning the output directory fails.

```ts
class CleanError extends CleanErrorBase<{
  readonly directory: string;
  readonly cause: unknown;
}>
```

## Members

### cause

```ts
readonly cause: unknown;
```

The underlying error or error message.

### directory

```ts
readonly directory: string;
```

The directory that failed to clean.
