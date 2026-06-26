---
id: packages/silk-effects/api/type/checkresultdefinition
title: "CheckResultDefinition — silk-effects type"
summary: "Result of a check operation."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# CheckResultDefinition

Result of a check operation.

```ts
type CheckResultDefinition = {
  readonly Found: {
    readonly isUpToDate: boolean;
    readonly diff: SectionDiff;
  };
  readonly NotFound: {};
};
```
