---
id: packages/github-action-effects/api/interface/pullrequestcommentteststate
title: "PullRequestCommentTestState — github-action-effects interface"
summary: "In-memory comment storage for testing."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestCommentTestState

In-memory comment storage for testing.

```ts
interface PullRequestCommentTestState
```

## Members

### comments

```ts
readonly comments: Map<number, Array<{
        id: number;
        body: string;
    }>>;
```

### nextId

```ts
nextId: number;
```
