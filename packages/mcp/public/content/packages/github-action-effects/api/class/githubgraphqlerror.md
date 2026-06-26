---
id: packages/github-action-effects/api/class/githubgraphqlerror
title: "GitHubGraphQLError — github-action-effects class"
summary: "Error from GitHub GraphQL operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubGraphQLError

Error from GitHub GraphQL operations.

```ts
class GitHubGraphQLError extends GitHubGraphQLError_base<{
  readonly operation: string;
  readonly reason: string;
  readonly errors: ReadonlyArray<{
    readonly message: string;
    readonly type?: string;
  }>;
}>
```

## Members

### errors

```ts
readonly errors: ReadonlyArray<{
    readonly message: string;
    readonly type?: string;
  }>;
```

### operation

```ts
readonly operation: string;
```

### reason

```ts
readonly reason: string;
```
