---
id: packages/silk-effects/api/type/syncresultdefinition
title: "SyncResultDefinition — silk-effects type"
summary: "Result of a sync operation."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SyncResultDefinition

Result of a sync operation.

```ts
type SyncResultDefinition = {
    readonly Created: {};
    readonly Updated: {
        readonly diff: SectionDiff;
    };
    readonly Unchanged: {};
};
```
