---
id: packages/github-action-effects/api/variable/treeentry
title: "TreeEntry — github-action-effects variable"
summary: "A single entry in a Git tree object. Either a content entry (add/update) or a deletion entry (sha: null)."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TreeEntry

A single entry in a Git tree object. Either a content entry (add/update) or a deletion entry (sha: null).

```ts
TreeEntry: Schema.Union<[Schema.Struct<{
    path: typeof Schema.String;
    mode: Schema.Literal<["100644", "100755", "040000"]>;
    content: typeof Schema.String;
}>, Schema.Struct<{
    path: typeof Schema.String;
    mode: Schema.Literal<["100644", "100755", "040000"]>;
    sha: typeof Schema.Null;
}>]>
```
