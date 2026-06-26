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
  readonly operation: "get" | "list" | "compare" | "changedFiles"; /** The ref involved, when known. */
  readonly ref?: string; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "get" | "list" | "compare" | "changedFiles";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

### ref

```ts
readonly ref?: string;
```
