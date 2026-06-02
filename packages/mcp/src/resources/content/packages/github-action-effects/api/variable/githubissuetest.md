---
id: packages/github-action-effects/api/variable/githubissuetest
title: "GitHubIssueTest — github-action-effects variable"
summary: "Test implementation for GitHubIssue."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubIssueTest

Test implementation for [GitHubIssue](silk://packages/github-action-effects/api/class/githubissue).

```ts
GitHubIssueTest: {
    readonly layer: (state: GitHubIssueTestState) => Layer.Layer<GitHubIssue>;
    readonly empty: () => {
        state: GitHubIssueTestState;
        layer: Layer.Layer<GitHubIssue>;
    };
}
```
