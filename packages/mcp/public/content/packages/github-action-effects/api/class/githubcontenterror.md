---
id: packages/github-action-effects/api/class/githubcontenterror
title: "GitHubContentError — github-action-effects class"
summary: "Error from GitHub repository-content operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubContentError

Error from GitHub repository-content operations.

```ts
class GitHubContentError extends GitHubContentError_base<{
  readonly operation: "getFile"; /** The path requested, when known. */
  readonly path?: string; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "getFile";
```

The operation that failed.

### path

```ts
readonly path?: string;
```

### reason

```ts
readonly reason: string;
```
