---
id: packages/github-action-effects/api/variable/npmpackageinfo
title: "NpmPackageInfo — github-action-effects variable"
summary: "Schema for npm package metadata."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# NpmPackageInfo

Schema for npm package metadata.

```ts
NpmPackageInfo: Schema.Struct<{
    name: typeof Schema.String;
    version: typeof Schema.String;
    distTags: Schema.Record$<typeof Schema.String, typeof Schema.String>;
    integrity: Schema.UndefinedOr<typeof Schema.String>;
    tarball: Schema.UndefinedOr<typeof Schema.String>;
}>
```
