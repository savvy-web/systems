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
    readonly operation: "get" | "list" | "listFiles" | "listAssociatedWithCommit" | "create" | "update" | "getOrCreate" | "merge" | "addLabels" | "requestReviewers" | "autoMerge";
    readonly prNumber?: number;
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

The PR number, when known.

### reason

```ts
readonly reason: string;
```

Human-readable description.
