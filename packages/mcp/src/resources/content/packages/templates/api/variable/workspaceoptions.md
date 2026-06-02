---
id: packages/templates/api/variable/workspaceoptions
title: "WorkspaceOptions — templates variable"
summary: "variable WorkspaceOptions from @savvy-web/templates."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# WorkspaceOptions

```ts
WorkspaceOptions: Schema.Struct<{
    name: typeof Schema.String;
    packageManager: Schema.Literal<["pnpm", "npm", "bun"]>;
    packageManagerVersion: typeof Schema.String;
    nodeVersion: typeof Schema.String;
    biomeVersion: Schema.optionalWith<typeof Schema.String, {
        default: () => string;
    }>;
    features: Schema.optional<Schema.Struct<{
        biome: Schema.optional<typeof Schema.Boolean>;
        vitest: Schema.optional<typeof Schema.Boolean>;
        turbo: Schema.optional<typeof Schema.Boolean>;
        changesets: Schema.optional<typeof Schema.Boolean>;
        vscode: Schema.optional<typeof Schema.Boolean>;
    }>>;
}>
```
