---
id: packages/github-action-effects/api/interface/actionoutputsteststate
title: "ActionOutputsTestState — github-action-effects interface"
summary: "In-memory state captured by the test output layer."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionOutputsTestState

In-memory state captured by the test output layer.

```ts
interface ActionOutputsTestState
```

## Members

### failed

```ts
readonly failed: Array<string>;
```

### outputs

```ts
readonly outputs: Array<CapturedOutput>;
```

### paths

```ts
readonly paths: Array<string>;
```

### secrets

```ts
readonly secrets: Array<string>;
```

### summaries

```ts
readonly summaries: Array<string>;
```

### variables

```ts
readonly variables: Array<CapturedOutput>;
```
