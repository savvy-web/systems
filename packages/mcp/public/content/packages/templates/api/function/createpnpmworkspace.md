---
id: packages/templates/api/function/createpnpmworkspace
title: "createPnpmWorkspace — templates function"
summary: "Generates a `pnpm-workspace.yaml` file entry."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# createPnpmWorkspace

Generates a `pnpm-workspace.yaml` file entry.

```ts
function createPnpmWorkspace(options: unknown): TemplateEntry[];
```

## Parameters

- `options` `unknown` — the pnpm workspace configuration options

## Returns

an array containing the generated `pnpm-workspace.yaml` entry
