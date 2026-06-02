---
id: packages/github-action-effects/api/variable/filechangecontent
title: "FileChangeContent — github-action-effects variable"
summary: "A file change that adds or updates a file."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# FileChangeContent

A file change that adds or updates a file.

```ts
FileChangeContent: Schema.Struct<{
    path: typeof Schema.String;
    content: typeof Schema.String;
}>
```
