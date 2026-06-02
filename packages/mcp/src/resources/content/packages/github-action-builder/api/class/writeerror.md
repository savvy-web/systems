---
id: packages/github-action-builder/api/class/writeerror
title: "WriteError — github-action-builder class"
summary: "Error when writing output files fails."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# WriteError

Error when writing output files fails.

```ts
class WriteError extends WriteErrorBase<{
    readonly path: string;
    readonly cause: unknown;
}>
```

## Members

### cause

```ts
readonly cause: unknown;
```

The underlying error or error message.

### path

```ts
readonly path: string;
```

The path that failed to write.
