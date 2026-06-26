---
id: packages/github-action-effects/api/class/gitbrancherror
title: "GitBranchError — github-action-effects class"
summary: "Error from branch management operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitBranchError

Error from branch management operations.

```ts
class GitBranchError extends GitBranchError_base<{
  readonly branch: string; /** The operation that failed. */
  readonly operation: "create" | "delete" | "get" | "reset"; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### branch

```ts
readonly branch: string;
```

The branch name.

### operation

```ts
readonly operation: "create" | "delete" | "get" | "reset";
```

### reason

```ts
readonly reason: string;
```
