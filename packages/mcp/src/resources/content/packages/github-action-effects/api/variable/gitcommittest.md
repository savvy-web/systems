---
id: packages/github-action-effects/api/variable/gitcommittest
title: "GitCommitTest — github-action-effects variable"
summary: "Test implementation for GitCommit."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitCommitTest

Test implementation for [GitCommit](silk://packages/github-action-effects/api/class/gitcommit).

```ts
GitCommitTest: {
    readonly layer: (state: GitCommitTestState) => Layer.Layer<GitCommit>;
    readonly empty: () => GitCommitTestState;
}
```
