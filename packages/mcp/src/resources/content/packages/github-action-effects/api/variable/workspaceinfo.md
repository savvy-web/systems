---
id: packages/github-action-effects/api/variable/workspaceinfo
title: "WorkspaceInfo — github-action-effects variable"
summary: "Workspace root information."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WorkspaceInfo

Workspace root information.

```ts
WorkspaceInfo: Schema.Struct<{
    root: typeof Schema.String;
    type: Schema.Literal<["single", "pnpm", "yarn", "npm", "bun"]>;
    patterns: Schema.Array$<typeof Schema.String>;
}>
```
