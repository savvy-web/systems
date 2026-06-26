---
id: packages/github-action-effects/api/variable/actioncachetest
title: "ActionCacheTest — github-action-effects variable"
summary: "Test implementation for ActionCache."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionCacheTest

Test implementation for [ActionCache](silk://packages/github-action-effects/api/class/actioncache).

```ts
ActionCacheTest: {
  readonly empty: () => ActionCacheTestState;
  readonly layer: (state: ActionCacheTestState) => Layer.Layer<ActionCache>;
}
```

## Examples

```ts
const state = ActionCacheTest.empty();
const layer = ActionCacheTest.layer(state);

```
