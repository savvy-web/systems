---
id: packages/silk-effects/api/variable/configlocation
title: "ConfigLocation — silk-effects variable"
summary: "The resolved location of a discovered config file."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ConfigLocation

The resolved location of a discovered config file.

```ts
ConfigLocation: Schema.Struct<{
    path: typeof Schema.String;
    source: Schema.Literal<["lib", "root", "cosmiconfig"]>;
}>
```
