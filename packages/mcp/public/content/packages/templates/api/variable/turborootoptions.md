---
id: packages/templates/api/variable/turborootoptions
title: "TurboRootOptions — templates variable"
summary: "Options for generating a root `turbo.json` file."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# TurboRootOptions

Options for generating a root `turbo.json` file.

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
