---
id: packages/github-action-effects/api/class/workflowdispatcherror
title: "WorkflowDispatchError — github-action-effects class"
summary: "Error from workflow dispatch operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WorkflowDispatchError

Error from workflow dispatch operations.

```ts
class WorkflowDispatchError extends WorkflowDispatchError_base<{
    readonly workflow: string;
    readonly operation: "dispatch" | "poll" | "poll-pending" | "status";
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "dispatch" | "poll" | "poll-pending" | "status";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.

### workflow

```ts
readonly workflow: string;
```

The workflow file or ID.
