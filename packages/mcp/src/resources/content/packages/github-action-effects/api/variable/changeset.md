---
id: packages/github-action-effects/api/variable/changeset
title: "Changeset — github-action-effects variable"
summary: "A parsed changeset with package bump mappings and summary."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# Changeset

A parsed changeset with package bump mappings and summary.

```ts
Changeset: Schema.Struct<{
    id: typeof Schema.String;
    packages: Schema.Array$<Schema.Struct<{
        name: typeof Schema.String;
        bump: Schema.Literal<["major", "minor", "patch"]>;
    }>>;
    summary: typeof Schema.String;
}>
```
