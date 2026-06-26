---
id: packages/github-action-effects/api/variable/dryruntest
title: "DryRunTest — github-action-effects variable"
summary: "Test implementation for DryRun."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# DryRunTest

Test implementation for [DryRun](silk://packages/github-action-effects/api/class/dryrun).

```ts
DryRunTest: {
  readonly layer: (state: DryRunTestState) => Layer.Layer<DryRun>;
  readonly empty: () => {
    state: DryRunTestState;
    layer: Layer.Layer<DryRun>;
  };
}
```
