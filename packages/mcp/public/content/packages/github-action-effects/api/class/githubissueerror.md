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
  readonly operation: "list" | "close" | "comment" | "getLinkedIssues" | "get"; /** The issue number, if applicable. */
  readonly issueNumber?: number; /** Human-readable description of what went wrong. */
  readonly reason: string; /** Whether this error is retryable (e.g., rate limit, 5xx). */
  readonly retryable: boolean;
}>
```

## Members

### issueNumber

```ts
readonly issueNumber?: number;
```

### operation

```ts
readonly operation: "list" | "close" | "comment" | "getLinkedIssues" | "get";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

### retryable

```ts
readonly retryable: boolean;
```
