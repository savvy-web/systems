---
id: packages/silk-effects/api/type/sectiondiffdefinition
title: "SectionDiffDefinition — silk-effects type"
summary: "Result of comparing two section contents."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SectionDiffDefinition

Result of comparing two section contents.

```ts
type SectionDiffDefinition = {
    readonly Unchanged: {};
    readonly Changed: {
        readonly added: ReadonlyArray<string>;
        readonly removed: ReadonlyArray<string>;
    };
};
```
