---
id: packages/github-action-effects/api/interface/tagref
title: "TagRef — github-action-effects interface"
summary: "A tag name and the commit SHA it resolves to."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TagRef

A tag name and the commit SHA it resolves to.

```ts
interface TagRef
```

## Members

### sha

```ts
readonly sha: string;
```

The commit SHA the tag resolves to. Annotated tags are dereferenced, so this is always a commit SHA — never a raw tag-object SHA.

### tag

```ts
readonly tag: string;
```
