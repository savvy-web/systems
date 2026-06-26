---
id: packages/github-action-effects/api/class/githubartifactmetadataerror
title: "GitHubArtifactMetadataError — github-action-effects class"
summary: "Error from GitHub Packages artifact-metadata operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubArtifactMetadataError

Error from GitHub Packages artifact-metadata operations.

```ts
class GitHubArtifactMetadataError extends GitHubArtifactMetadataError_base<{
  readonly operation: "createStorageRecord"; /** Human-readable description of what went wrong. */
  readonly reason: string; /** Whether this error is retryable (e.g., rate limit, 5xx). */
  readonly retryable: boolean;
}>
```

## Members

### operation

```ts
readonly operation: "createStorageRecord";
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
