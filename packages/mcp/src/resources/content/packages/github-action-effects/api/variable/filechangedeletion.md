---
id: packages/github-action-effects/api/variable/filechangedeletion
title: "FileChangeDeletion — github-action-effects variable"
summary: "A file change that deletes a file (sha: null)."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# FileChangeDeletion

A file change that deletes a file (sha: null).

```ts
FileChangeDeletion: Schema.Struct<{
    path: typeof Schema.String;
    sha: typeof Schema.Null;
}>
```
