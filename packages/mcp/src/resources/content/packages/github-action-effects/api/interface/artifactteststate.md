---
id: packages/github-action-effects/api/interface/artifactteststate
title: "ArtifactTestState — github-action-effects interface"
summary: "In-memory artifact state for testing."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ArtifactTestState

In-memory artifact state for testing.

```ts
interface ArtifactTestState
```

## Members

### artifacts

```ts
readonly artifacts: Map<string, ArtifactItem>;
```

### nextId

```ts
nextId: number;
```

### uploaded

```ts
readonly uploaded: Map<string, ReadonlyArray<string>>;
```
