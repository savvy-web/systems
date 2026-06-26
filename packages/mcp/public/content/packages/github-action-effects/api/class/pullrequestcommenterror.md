---
id: packages/github-action-effects/api/class/pullrequestcommenterror
title: "PullRequestCommentError — github-action-effects class"
summary: "Error from PR comment operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestCommentError

Error from PR comment operations.

```ts
class PullRequestCommentError extends PullRequestCommentError_base<{
  readonly prNumber: number; /** The operation that failed. */
  readonly operation: "create" | "upsert" | "find" | "delete"; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "create" | "upsert" | "find" | "delete";
```

### prNumber

```ts
readonly prNumber: number;
```

The PR number.

### reason

```ts
readonly reason: string;
```
