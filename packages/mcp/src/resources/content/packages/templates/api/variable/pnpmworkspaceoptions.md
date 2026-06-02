---
id: packages/templates/api/variable/pnpmworkspaceoptions
title: "PnpmWorkspaceOptions — templates variable"
summary: "variable PnpmWorkspaceOptions from @savvy-web/templates."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# PnpmWorkspaceOptions

```ts
PnpmWorkspaceOptions: Schema.Struct<{
    packages: Schema.Array$<typeof Schema.String>;
    autoInstallPeers: Schema.optional<typeof Schema.Boolean>;
    catalogMode: Schema.optional<Schema.Literal<["strict", "prefer", "manual"]>>;
    catalog: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
}>
```
