---
id: packages/github-action-effects/api/variable/treeentrycontent
title: "TreeEntryContent — github-action-effects variable"
summary: "A tree entry that adds or updates a file."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TreeEntryContent

A tree entry that adds or updates a file.

```ts
TreeEntryContent: Schema.Struct<{
    path: typeof Schema.String;
    mode: Schema.Literal<["100644", "100755", "040000"]>;
    content: typeof Schema.String;
}>
```
