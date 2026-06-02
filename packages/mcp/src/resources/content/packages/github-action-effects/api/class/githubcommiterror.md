---
id: packages/github-action-effects/api/class/githubcommiterror
title: "GitHubCommitError — github-action-effects class"
summary: "Error from GitHub commit operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubCommitError

Error from GitHub commit operations.

```ts
class GitHubCommitError extends GitHubCommitError_base<{
    readonly operation: "get" | "list" | "compare";
    readonly ref?: string;
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "get" | "list" | "compare";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description.

### ref

```ts
readonly ref?: string;
```

The ref involved, when known.
