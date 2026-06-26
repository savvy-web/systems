---
id: packages/templates/api/variable/turboworkspaceoptions
title: "TurboWorkspaceOptions — templates variable"
summary: "Options for generating a workspace-level `turbo.json` file."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# TurboWorkspaceOptions

Options for generating a workspace-level `turbo.json` file.

```ts
TurboWorkspaceOptions: Schema.Struct<{
  tasks: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.Unknown>>;
}>
```
