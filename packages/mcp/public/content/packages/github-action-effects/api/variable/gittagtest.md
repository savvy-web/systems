---
id: packages/github-action-effects/api/variable/gittagtest
title: "GitTagTest — github-action-effects variable"
summary: "Test implementation for GitTag."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitTagTest

Test implementation for [GitTag](silk://packages/github-action-effects/api/class/gittag).

```ts
GitTagTest: {
  readonly layer: (state: GitTagTestState) => Layer.Layer<GitTag>; /** Create a fresh test state and layer. */
  readonly empty: () => {
    state: GitTagTestState;
    layer: Layer.Layer<GitTag>;
  };
}
```
