---
id: packages/templates/api/function/createturboworkspace
title: "createTurboWorkspace — templates function"
summary: "Generates a workspace-level `turbo.json` file entry."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# createTurboWorkspace

Generates a workspace-level `turbo.json` file entry.

```ts
function createTurboWorkspace(options: unknown): TemplateEntry[];
```

## Parameters

- `options` `unknown` — the workspace Turborepo configuration options

## Returns

an array containing the generated workspace `turbo.json` entry
