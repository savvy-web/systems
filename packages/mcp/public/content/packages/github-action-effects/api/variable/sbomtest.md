---
id: packages/github-action-effects/api/variable/sbomtest
title: "SbomTest — github-action-effects variable"
summary: "Test layer factories for Sbom."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SbomTest

Test layer factories for [Sbom](silk://packages/github-action-effects/api/class/sbom).

```ts
SbomTest: {
  layer: (state: SbomTestState) => Layer.Layer<Sbom>;
  empty: () => Layer.Layer<Sbom>;
}
```
