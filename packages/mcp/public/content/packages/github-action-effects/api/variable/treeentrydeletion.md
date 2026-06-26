---
id: packages/github-action-effects/api/variable/treeentrydeletion
title: "TreeEntryDeletion — github-action-effects variable"
summary: "A tree entry that deletes a file (sha: null)."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TreeEntryDeletion

A tree entry that deletes a file (sha: null).

```ts
TreeEntryDeletion: Schema.Struct<{
  path: typeof Schema.String;
  mode: Schema.Literal<["100644", "100755", "040000"]>;
  sha: typeof Schema.Null;
}>
```
