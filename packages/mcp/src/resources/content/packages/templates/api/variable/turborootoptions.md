---
id: packages/templates/api/variable/turborootoptions
title: "TurboRootOptions — templates variable"
summary: "variable TurboRootOptions from @savvy-web/templates."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# TurboRootOptions

```ts
TurboRootOptions: Schema.Struct<{
    tasks: Schema.Record$<typeof Schema.String, typeof Schema.Unknown>;
    globalDependencies: Schema.optional<Schema.Array$<typeof Schema.String>>;
    globalEnv: Schema.optional<Schema.Array$<typeof Schema.String>>;
    globalPassThroughEnv: Schema.optional<Schema.Array$<typeof Schema.String>>;
    ui: Schema.optional<Schema.Literal<["tui", "stream"]>>;
    concurrency: Schema.optional<Schema.Union<[typeof Schema.String, typeof Schema.Number]>>;
}>
```
