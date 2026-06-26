---
id: packages/github-action-effects/api/class/blobstoreerror
title: "BlobStoreError — github-action-effects class"
summary: "Error when a blob store operation (get, put, or has) fails."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# BlobStoreError

Error when a blob store operation (get, put, or has) fails.

```ts
class BlobStoreError extends BlobStoreError_base<{
  readonly key: string; /** The operation that failed. */
  readonly operation: "get" | "put" | "has"; /** Human-readable description of what went wrong. */
  readonly reason: string;
}>
```

## Members

### key

```ts
readonly key: string;
```

The blob key involved.

### operation

```ts
readonly operation: "get" | "put" | "has";
```

### reason

```ts
readonly reason: string;
```
