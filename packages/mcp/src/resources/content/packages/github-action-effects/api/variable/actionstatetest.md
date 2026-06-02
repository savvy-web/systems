---
id: packages/github-action-effects/api/variable/actionstatetest
title: "ActionStateTest — github-action-effects variable"
summary: "Test implementation that captures state in memory."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionStateTest

Test implementation that captures state in memory.

```ts
ActionStateTest: {
    readonly empty: () => ActionStateTestState;
    readonly layer: (state: ActionStateTestState) => Layer.Layer<ActionState>;
}
```

## Examples

```ts
const state = ActionStateTest.empty();
const layer = ActionStateTest.layer(state);

```
