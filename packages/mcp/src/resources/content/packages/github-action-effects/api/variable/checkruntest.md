---
id: packages/github-action-effects/api/variable/checkruntest
title: "CheckRunTest — github-action-effects variable"
summary: "Test implementation for CheckRun."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CheckRunTest

Test implementation for [CheckRun](silk://packages/github-action-effects/api/class/checkrun).

```ts
CheckRunTest: {
    readonly layer: (state: CheckRunTestState) => Layer.Layer<CheckRun>;
    readonly empty: () => CheckRunTestState;
}
```
