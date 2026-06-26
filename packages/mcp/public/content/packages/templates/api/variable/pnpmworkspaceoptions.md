---
id: packages/templates/api/variable/pnpmworkspaceoptions
title: "PnpmWorkspaceOptions — templates variable"
summary: "Options for generating a `pnpm-workspace.yaml` file."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# PnpmWorkspaceOptions

Options for generating a `pnpm-workspace.yaml` file.

```ts
PnpmWorkspaceOptions: Schema.Struct<{
  packages: Schema.Array$<typeof Schema.String>;
  autoInstallPeers: Schema.optional<typeof Schema.Boolean>;
  catalogMode: Schema.optional<Schema.Literal<["strict", "prefer", "manual"]>>;
  catalog: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
}>
```
