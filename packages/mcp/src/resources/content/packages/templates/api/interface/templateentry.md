---
id: packages/templates/api/interface/templateentry
title: "TemplateEntry — templates interface"
summary: "A generated content entry from a template. Templates produce content with a logical name and suggested filename. The consumer decides where (and whether) to wr…"
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# TemplateEntry

A generated content entry from a template. Templates produce content with a logical name and suggested filename. The consumer decides where (and whether) to write the content.

```ts
interface TemplateEntry
```

## Members

### content

```ts
readonly content: string;
```

The generated file content

### filename

```ts
readonly filename: string;
```

Suggested default filename (e.g., "tsconfig.json", ".vscode/settings.json")

### name

```ts
readonly name: string;
```

Logical name for this entry (e.g., "tsconfig", "biome", "vscode-settings")
