---
id: packages/github-action-effects/api/variable/npmregistrytest
title: "NpmRegistryTest — github-action-effects variable"
summary: "Test implementation for NpmRegistry."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# NpmRegistryTest

Test implementation for [NpmRegistry](silk://packages/github-action-effects/api/class/npmregistry).

```ts
NpmRegistryTest: {
  readonly layer: (state: NpmRegistryTestState) => Layer.Layer<NpmRegistry>;
  readonly empty: () => Layer.Layer<NpmRegistry>;
}
```
