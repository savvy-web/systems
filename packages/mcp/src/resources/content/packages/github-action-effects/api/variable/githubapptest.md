---
id: packages/github-action-effects/api/variable/githubapptest
title: "GitHubAppTest — github-action-effects variable"
summary: "Test implementation for GitHubApp."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubAppTest

Test implementation for [GitHubApp](silk://packages/github-action-effects/api/class/githubapp).

```ts
GitHubAppTest: {
    readonly layer: (state: GitHubAppTestState) => Layer.Layer<GitHubApp>;
    readonly empty: () => GitHubAppTestState;
}
```
