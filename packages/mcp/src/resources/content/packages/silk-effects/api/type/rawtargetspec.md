---
id: packages/silk-effects/api/type/rawtargetspec
title: "RawTargetSpec — silk-effects type"
summary: "A single declared publish target in a raw `publishConfig.targets` array."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# RawTargetSpec

A single declared publish target in a raw `publishConfig.targets` array.

```ts
type RawTargetSpec = string | {
    readonly access?: "public" | "restricted";
    readonly protocol?: string;
    readonly registry?: string;
    readonly directory?: string;
    readonly provenance?: boolean;
};
```
