---
id: packages/github-action-effects/api/variable/filechange
title: "FileChange — github-action-effects variable"
summary: "A file change for the commitFiles convenience method. Either a content change (add/update) or a deletion (sha: null)."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# FileChange

A file change for the commitFiles convenience method. Either a content change (add/update) or a deletion (sha: null).

```ts
FileChange: Schema.Union<[Schema.Struct<{
  path: typeof Schema.String;
  content: typeof Schema.String;
}>, Schema.Struct<{
  path: typeof Schema.String;
  sha: typeof Schema.Null;
}>]>
```
