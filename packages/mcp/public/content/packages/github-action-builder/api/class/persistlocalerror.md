---
id: packages/github-action-builder/api/class/persistlocalerror
title: "PersistLocalError — github-action-builder class"
summary: "Error when persisting build output to local action directory fails."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# PersistLocalError

Error when persisting build output to local action directory fails.

```ts
class PersistLocalError extends PersistLocalErrorBase<{
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

The path involved in the failure.
