---
id: packages/github-action-effects/api/variable/permissioncheckresult
title: "PermissionCheckResult — github-action-effects variable"
summary: "Result of a permission check comparing granted vs required."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PermissionCheckResult

Result of a permission check comparing granted vs required.

```ts
PermissionCheckResult: Schema.Struct<{
    granted: Schema.Record$<typeof Schema.String, Schema.Literal<["read", "write", "admin"]>>;
    required: Schema.Record$<typeof Schema.String, Schema.Literal<["read", "write", "admin"]>>;
    missing: Schema.Array$<Schema.Struct<{
        permission: typeof Schema.String;
        required: Schema.Literal<["read", "write", "admin"]>;
        granted: Schema.UndefinedOr<Schema.Literal<["read", "write", "admin"]>>;
    }>>;
    extra: Schema.Array$<Schema.Struct<{
        permission: typeof Schema.String;
        level: Schema.Literal<["read", "write", "admin"]>;
    }>>;
    satisfied: typeof Schema.Boolean;
}>
```
