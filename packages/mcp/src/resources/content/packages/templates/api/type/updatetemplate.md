---
id: packages/templates/api/type/updatetemplate
title: "UpdateTemplate — templates type"
summary: "An update template: existing content + partial options in, content entries out."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# UpdateTemplate

An update template: existing content + partial options in, content entries out.

```ts
type UpdateTemplate<O> = (existing: string, options: Partial<O>) => TemplateEntry[];
```
