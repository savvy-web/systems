---
id: packages/github-action-effects/api/variable/workflowdispatchtest
title: "WorkflowDispatchTest — github-action-effects variable"
summary: "Test implementation for WorkflowDispatch."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WorkflowDispatchTest

Test implementation for [WorkflowDispatch](silk://packages/github-action-effects/api/class/workflowdispatch).

```ts
WorkflowDispatchTest: {
    readonly layer: (state: WorkflowDispatchTestState) => Layer.Layer<WorkflowDispatch>;
    readonly empty: () => WorkflowDispatchTestState;
}
```
