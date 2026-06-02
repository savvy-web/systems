---
id: packages/github-action-builder/api/variable/buildlayer
title: "BuildLayer — github-action-builder variable"
summary: "Layer providing BuildService (depends on ConfigService)."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BuildLayer

Layer providing [BuildService](silk://packages/github-action-builder/api/variable/buildservice) (depends on [ConfigService](silk://packages/github-action-builder/api/variable/configservice)).

```ts
BuildLayer: Layer.Layer<import("../index.js").BuildService, never, never>
```
