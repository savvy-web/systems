---
id: packages/github-action-effects/api/variable/permissiongap
title: "PermissionGap — github-action-effects variable"
summary: "A missing or insufficient permission."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PermissionGap

A missing or insufficient permission.

```ts
PermissionGap: Schema.Struct<{
    permission: typeof Schema.String;
    required: Schema.Literal<["read", "write", "admin"]>;
    granted: Schema.UndefinedOr<Schema.Literal<["read", "write", "admin"]>>;
}>
```
