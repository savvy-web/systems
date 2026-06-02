---
id: packages/templates/api/variable/changesetoptions
title: "ChangesetOptions — templates variable"
summary: "variable ChangesetOptions from @savvy-web/templates."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# ChangesetOptions

```ts
ChangesetOptions: Schema.Struct<{
    access: Schema.optionalWith<Schema.Literal<["public", "restricted"]>, {
        default: () => "restricted";
    }>;
    baseBranch: Schema.optionalWith<typeof Schema.String, {
        default: () => string;
    }>;
    changelog: Schema.optionalWith<typeof Schema.String, {
        default: () => string;
    }>;
    repo: Schema.optional<Schema.filter<typeof Schema.String>>;
}>
```
