---
id: packages/github-action-effects/api/variable/artifacttest
title: "ArtifactTest — github-action-effects variable"
summary: "Test implementation for Artifact."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ArtifactTest

Test implementation for [Artifact](silk://packages/github-action-effects/api/class/artifact).

```ts
ArtifactTest: {
    readonly empty: () => ArtifactTestState;
    readonly layer: (state: ArtifactTestState) => Layer.Layer<Artifact>;
}
```

## Examples

```ts
const state = ArtifactTest.empty();
const layer = ArtifactTest.layer(state);

```
