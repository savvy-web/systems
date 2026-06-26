---
id: packages/templates/api/function/createvscode
title: "createVsCode — templates function"
summary: "Generates `.vscode/settings.json` and `.vscode/extensions.json` file entries."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# createVsCode

Generates `.vscode/settings.json` and `.vscode/extensions.json` file entries.

```ts
function createVsCode(options: unknown): TemplateEntry[];
```

## Parameters

- `options` `unknown` — the VS Code configuration options

## Returns

an array containing the generated VS Code configuration entries
