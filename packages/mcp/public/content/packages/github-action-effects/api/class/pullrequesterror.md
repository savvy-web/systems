---
id: packages/github-action-effects/api/class/pullrequesterror
title: "PullRequestError — github-action-effects class"
summary: "Error from pull request operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestError

Error from pull request operations.

```ts
class PullRequestError extends PullRequestError_base<{
  readonly operation: "get" | "list" | "listFiles" | "listAssociatedWithCommit" | "create" | "update" | "getOrCreate" | "merge" | "addLabels" | "requestReviewers" | "autoMerge"; /** The PR number, when known. */
  readonly prNumber?: number; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "get" | "list" | "listFiles" | "listAssociatedWithCommit" | "create" | "update" | "getOrCreate" | "merge" | "addLabels" | "requestReviewers" | "autoMerge";
```

The operation that failed.

### prNumber

```ts
readonly prNumber?: number;
```

### reason

```ts
readonly reason: string;
```
