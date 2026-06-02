---
id: packages/github-action-effects/api/class/globerror
title: "GlobError — github-action-effects class"
summary: "Error when a glob operation (pattern resolution or hashFiles) fails."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GlobError

Error when a glob operation (pattern resolution or hashFiles) fails.

```ts
class GlobError extends GlobError_base<{
    readonly operation: "glob" | "hashFiles";
    readonly patterns: string;
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "glob" | "hashFiles";
```

The operation that failed.

### patterns

```ts
readonly patterns: string;
```

The patterns string involved.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.
