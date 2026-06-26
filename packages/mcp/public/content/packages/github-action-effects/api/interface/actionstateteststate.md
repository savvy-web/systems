---
id: packages/github-action-effects/api/interface/actionstateteststate
title: "ActionStateTestState — github-action-effects interface"
summary: "In-memory state captured by the test state layer."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionStateTestState

In-memory state captured by the test state layer.

```ts
interface ActionStateTestState
```

## Members

### entries

```ts
readonly entries: Map<string, string>;
```

Stored state entries (key to JSON string).
