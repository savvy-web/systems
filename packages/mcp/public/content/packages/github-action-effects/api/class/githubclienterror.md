---
id: packages/github-action-effects/api/class/githubclienterror
title: "GitHubClientError — github-action-effects class"
summary: "Error from GitHub API operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubClientError

Error from GitHub API operations.

```ts
class GitHubClientError extends GitHubClientError_base<{
  readonly operation: string; /** HTTP status code, if available. */
  readonly status: number | undefined; /** Human-readable description of what went wrong. */
  readonly reason: string; /** Whether this error is retryable (e.g., rate limit, 5xx). */
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined;
}>
```

## Members

### operation

```ts
readonly operation: string;
```

The operation that failed (e.g., "rest.repos.get", "graphql").

### reason

```ts
readonly reason: string;
```

### retryable

```ts
readonly retryable: boolean;
```

### retryAfterMs

```ts
readonly retryAfterMs: number | undefined;
```

Server-advised delay before retrying, in milliseconds, if the response carried a `Retry-After` header or an exhausted `x-ratelimit-reset`. `undefined` when the server gave no explicit hint (the resilient client then falls back to its exponential backoff).

### status

```ts
readonly status: number | undefined;
```
