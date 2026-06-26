---
id: packages/github-action-effects/api/class/gittagerror
title: "GitTagError — github-action-effects class"
summary: "Error from tag management operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitTagError

Error from tag management operations.

```ts
class GitTagError extends GitTagError_base<{
  readonly operation: "create" | "delete" | "list" | "resolve"; /** The tag name, if applicable. */
  readonly tag?: string; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "create" | "delete" | "list" | "resolve";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

### tag

```ts
readonly tag?: string;
```
