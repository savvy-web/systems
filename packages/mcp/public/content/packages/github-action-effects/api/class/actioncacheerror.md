---
id: packages/github-action-effects/api/class/actioncacheerror
title: "ActionCacheError — github-action-effects class"
summary: "Error when a cache operation (save or restore) fails."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionCacheError

Error when a cache operation (save or restore) fails.

```ts
class ActionCacheError extends ActionCacheError_base<{
  readonly key: string; /** The operation that failed. */
  readonly operation: "save" | "restore"; /** Human-readable description of what went wrong. */
  readonly reason: string;
}>
```

## Members

### key

```ts
readonly key: string;
```

The cache key involved.

### operation

```ts
readonly operation: "save" | "restore";
```

### reason

```ts
readonly reason: string;
```
