---
id: packages/github-action-effects/api/variable/packagemanagerinfo
title: "PackageManagerInfo — github-action-effects variable"
summary: "Information about a detected package manager."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackageManagerInfo

Information about a detected package manager.

```ts
PackageManagerInfo: Schema.Struct<{
    name: Schema.Literal<["npm", "pnpm", "yarn", "bun", "deno"]>;
    version: typeof Schema.String;
    lockfile: Schema.UndefinedOr<typeof Schema.String>;
}>
```
