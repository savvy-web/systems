---
id: packages/github-action-effects/api/variable/workspacepackage
title: "WorkspacePackage — github-action-effects variable"
summary: "A workspace package entry."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WorkspacePackage

A workspace package entry.

```ts
WorkspacePackage: Schema.Struct<{
  name: typeof Schema.String;
  version: typeof Schema.String;
  path: typeof Schema.String;
  private: typeof Schema.Boolean;
  dependencies: Schema.Record$<typeof Schema.String, typeof Schema.String>;
}>
```
