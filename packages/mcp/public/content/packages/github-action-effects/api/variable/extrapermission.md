---
id: packages/github-action-effects/api/variable/extrapermission
title: "ExtraPermission — github-action-effects variable"
summary: "A permission granted but not required."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ExtraPermission

A permission granted but not required.

```ts
ExtraPermission: Schema.Struct<{
  permission: typeof Schema.String;
  level: Schema.Literal<["read", "write", "admin"]>;
}>
```
