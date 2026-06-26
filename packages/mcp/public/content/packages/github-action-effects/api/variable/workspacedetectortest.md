---
id: packages/github-action-effects/api/variable/workspacedetectortest
title: "WorkspaceDetectorTest — github-action-effects variable"
summary: "Test implementation for WorkspaceDetector."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WorkspaceDetectorTest

Test implementation for [WorkspaceDetector](silk://packages/github-action-effects/api/class/workspacedetector).

```ts
WorkspaceDetectorTest: {
  readonly layer: (state: WorkspaceDetectorTestState) => Layer.Layer<WorkspaceDetector>;
  readonly empty: () => Layer.Layer<WorkspaceDetector>;
}
```
