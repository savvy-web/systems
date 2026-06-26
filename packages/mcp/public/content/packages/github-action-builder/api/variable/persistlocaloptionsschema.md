---
id: packages/github-action-builder/api/variable/persistlocaloptionsschema
title: "PersistLocalOptionsSchema — github-action-builder variable"
summary: "Schema for persist-local options."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# PersistLocalOptionsSchema

Schema for persist-local options.

```ts
PersistLocalOptionsSchema: Schema.Struct<{
  enabled: Schema.optionalWith<typeof Schema.Boolean, {
    default: () => true;
  }>; /** Path for the local action directory, relative to cwd. Defaults to ".github/actions/local". */
  path: Schema.optionalWith<typeof Schema.String, {
    default: () => string;
  }>; /** Generate act boilerplate files (.actrc, act-test.yml) if they don't exist. Defaults to true. */
  actTemplate: Schema.optionalWith<typeof Schema.Boolean, {
    default: () => true;
  }>;
}>
```
