---
id: packages/github-action-effects/api/interface/workflowdispatchteststate
title: "WorkflowDispatchTestState — github-action-effects interface"
summary: "Test state for WorkflowDispatch."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WorkflowDispatchTestState

Test state for [WorkflowDispatch](silk://packages/github-action-effects/api/class/workflowdispatch).

```ts
interface WorkflowDispatchTestState
```

## Members

### dispatches

```ts
readonly dispatches: Array<DispatchRecord>;
```

### statuses

```ts
readonly statuses: Map<number, WorkflowRunStatus>;
```

### waitConclusion

```ts
waitConclusion: string;
```

Conclusion to return from dispatchAndWait. Defaults to "success".
