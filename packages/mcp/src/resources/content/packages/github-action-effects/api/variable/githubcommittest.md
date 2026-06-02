---
id: packages/github-action-effects/api/variable/githubcommittest
title: "GitHubCommitTest — github-action-effects variable"
summary: "Test implementation for GitHubCommit."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubCommitTest

Test implementation for [GitHubCommit](silk://packages/github-action-effects/api/class/githubcommit).

```ts
GitHubCommitTest: {
    readonly layer: (state: GitHubCommitTestState) => Layer.Layer<GitHubCommit>;
    readonly empty: () => GitHubCommitTestState;
}
```
