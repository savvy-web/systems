---
id: packages/github-action-effects/api/class/ratelimiterror
title: "RateLimitError — github-action-effects class"
summary: "Error when GitHub API rate limit is exhausted or nearly exhausted."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RateLimitError

Error when GitHub API rate limit is exhausted or nearly exhausted.

```ts
class RateLimitError extends RateLimitError_base<{
  readonly api: "rest" | "graphql"; /** Remaining requests before exhaustion. */
  readonly remaining: number; /** ISO timestamp when the rate limit resets. */
  readonly resetAt: string; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### api

```ts
readonly api: "rest" | "graphql";
```

Which API is rate limited.

### reason

```ts
readonly reason: string;
```

### remaining

```ts
readonly remaining: number;
```

### resetAt

```ts
readonly resetAt: string;
```
