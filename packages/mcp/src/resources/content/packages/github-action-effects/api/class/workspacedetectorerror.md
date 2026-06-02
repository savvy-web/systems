---
id: packages/github-action-effects/api/class/workspacedetectorerror
title: "WorkspaceDetectorError — github-action-effects class"
summary: "Error from workspace detection operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WorkspaceDetectorError

Error from workspace detection operations.

```ts
class WorkspaceDetectorError extends WorkspaceDetectorError_base<{
    readonly operation: "detect" | "list" | "get";
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "detect" | "list" | "get";
```

### reason

```ts
readonly reason: string;
```
