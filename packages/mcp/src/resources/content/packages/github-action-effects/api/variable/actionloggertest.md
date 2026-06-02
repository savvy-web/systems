---
id: packages/github-action-effects/api/variable/actionloggertest
title: "ActionLoggerTest — github-action-effects variable"
summary: "Test implementation that captures log operations in memory."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionLoggerTest

Test implementation that captures log operations in memory.

```ts
ActionLoggerTest: {
    readonly empty: () => ActionLoggerTestState;
    readonly layer: (state: ActionLoggerTestState) => Layer.Layer<ActionLogger>;
}
```

## Examples

```ts
const state = ActionLoggerTest.empty();
const layer = ActionLoggerTest.layer(state);

```
