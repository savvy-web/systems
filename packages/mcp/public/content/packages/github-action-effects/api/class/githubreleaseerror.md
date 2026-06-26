---
id: packages/github-action-effects/api/class/githubreleaseerror
title: "GitHubReleaseError — github-action-effects class"
summary: "Error from GitHub Release operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubReleaseError

Error from GitHub Release operations.

```ts
class GitHubReleaseError extends GitHubReleaseError_base<{
  readonly operation: "create" | "uploadAsset" | "getByTag" | "list" | "updateRelease" | "listReleaseAssets"; /** The release tag, if applicable. */
  readonly tag?: string; /** Human-readable description of what went wrong. */
  readonly reason: string; /** Whether this error is retryable (e.g., rate limit, 5xx). */
  readonly retryable: boolean;
}>
```

## Members

### operation

```ts
readonly operation: "create" | "uploadAsset" | "getByTag" | "list" | "updateRelease" | "listReleaseAssets";
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

### tag

```ts
readonly tag?: string;
```
