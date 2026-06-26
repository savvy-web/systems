---
id: packages/github-action-effects/api/variable/pullrequestcommenttest
title: "PullRequestCommentTest — github-action-effects variable"
summary: "Test implementation for PullRequestComment."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestCommentTest

Test implementation for [PullRequestComment](silk://packages/github-action-effects/api/class/pullrequestcomment).

```ts
PullRequestCommentTest: {
  readonly empty: () => PullRequestCommentTestState;
  readonly layer: (state: PullRequestCommentTestState) => Layer.Layer<PullRequestComment>;
}
```
