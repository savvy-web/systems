---
id: packages/github-action-effects/api/class/githubissueerror
title: "GitHubIssueError — github-action-effects class"
summary: "Error from GitHub Issue operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubIssueError

Error from GitHub Issue operations.

```ts
class GitHubIssueError extends GitHubIssueError_base<{
    readonly operation: "list" | "close" | "comment" | "getLinkedIssues" | "get";
    readonly issueNumber?: number;
    readonly reason: string;
    readonly retryable: boolean;
}>
```

## Members

### issueNumber

```ts
readonly issueNumber?: number;
```

The issue number, if applicable.

### operation

```ts
readonly operation: "list" | "close" | "comment" | "getLinkedIssues" | "get";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.

### retryable

```ts
readonly retryable: boolean;
```

Whether this error is retryable (e.g., rate limit, 5xx).
