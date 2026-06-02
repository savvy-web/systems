---
id: packages/github-action-effects/api/class/gitcommiterror
title: "GitCommitError — github-action-effects class"
summary: "Error from git commit operations via Git Data API."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitCommitError

Error from git commit operations via Git Data API.

```ts
class GitCommitError extends GitCommitError_base<{
    readonly operation: "tree" | "commit" | "ref";
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "tree" | "commit" | "ref";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description.
