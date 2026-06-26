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
  readonly workflow: string; /** The operation that failed. */
  readonly operation: "dispatch" | "poll" | "poll-pending" | "status"; /** Human-readable description of what went wrong. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "dispatch" | "poll" | "poll-pending" | "status";
```

### reason

```ts
readonly reason: string;
```

### workflow

```ts
readonly workflow: string;
```

The workflow file or ID.
