---
id: packages/github-action-effects/api/variable/actionoutputstest
title: "ActionOutputsTest — github-action-effects variable"
summary: "Test implementation that captures outputs in memory."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionOutputsTest

Test implementation that captures outputs in memory.

```ts
ActionOutputsTest: {
  readonly empty: () => ActionOutputsTestState;
  readonly layer: (state: ActionOutputsTestState) => Layer.Layer<ActionOutputs>;
}
```

## Examples

```ts
const state = ActionOutputsTest.empty();
const layer = ActionOutputsTest.layer(state);

```
