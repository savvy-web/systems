---
id: packages/silk-effects/api/variable/versioningstrategyresult
title: "VersioningStrategyResult — silk-effects variable"
summary: "Output of the versioning strategy detection, combining the strategy type with group metadata."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# VersioningStrategyResult

Output of the versioning strategy detection, combining the strategy type with group metadata.

```ts
VersioningStrategyResult: Schema.Struct<{
  type: Schema.Literal<["single", "fixed-group", "independent"]>;
  fixedGroups: Schema.Array$<Schema.Array$<typeof Schema.String>>;
  publishablePackages: Schema.Array$<typeof Schema.String>;
}>
```
