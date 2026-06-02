---
id: packages/github-action-effects/api/class/checkrunerror
title: "CheckRunError — github-action-effects class"
summary: "Error from check run operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CheckRunError

Error from check run operations.

```ts
class CheckRunError extends CheckRunError_base<{
    readonly name: string;
    readonly operation: "create" | "update" | "complete" | "get";
    readonly reason: string;
}>
```

## Members

### name

```ts
readonly name: string;
```

The check run name.

### operation

```ts
readonly operation: "create" | "update" | "complete" | "get";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description.
