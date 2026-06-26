---
id: packages/github-action-effects/api/interface/commitdetail
title: "CommitDetail — github-action-effects interface"
summary: "A single commit with its parent SHAs."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CommitDetail

A single commit with its parent SHAs.

```ts
interface CommitDetail extends CommitSummary
```

## Members

### parents

```ts
readonly parents: ReadonlyArray<{
    readonly sha: string;
  }>;
```
