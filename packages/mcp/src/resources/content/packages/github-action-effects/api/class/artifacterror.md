---
id: packages/github-action-effects/api/class/artifacterror
title: "ArtifactError — github-action-effects class"
summary: "Error when an artifact operation (upload, download, list, get, delete) fails."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ArtifactError

Error when an artifact operation (upload, download, list, get, delete) fails.

```ts
class ArtifactError extends ArtifactError_base<{
    readonly operation: "upload" | "download" | "list" | "get" | "delete";
    readonly artifact: string;
    readonly reason: string;
    readonly retryable?: boolean;
}>
```

## Members

### artifact

```ts
readonly artifact: string;
```

[Artifact](silk://packages/github-action-effects/api/class/artifact) name or id (string for uniform formatting).

### operation

```ts
readonly operation: "upload" | "download" | "list" | "get" | "delete";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.

### retryable

```ts
readonly retryable?: boolean;
```

True for 5xx / network failures — the caller may retry. Mirrors `GitHubClientError`'s `retryable` flag for consistency with the WS2 retry story.
