---
id: packages/github-action-effects/api/variable/globtest
title: "GlobTest — github-action-effects variable"
summary: "Test implementation for Glob."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GlobTest

Test implementation for [Glob](silk://packages/github-action-effects/api/class/glob).

```ts
GlobTest: {
    readonly empty: () => GlobTestState;
    readonly layer: (state: GlobTestState) => Layer.Layer<Glob>;
}
```

## Examples

```ts
const state = GlobTest.empty();
state.matches.set("*.ts", ["/repo/a.ts", "/repo/b.ts"]);
const layer = GlobTest.layer(state);

```
