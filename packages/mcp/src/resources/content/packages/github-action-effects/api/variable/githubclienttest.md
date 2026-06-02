---
id: packages/github-action-effects/api/variable/githubclienttest
title: "GitHubClientTest — github-action-effects variable"
summary: "Test implementation for GitHubClient."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubClientTest

Test implementation for [GitHubClient](silk://packages/github-action-effects/api/class/githubclient).

```ts
GitHubClientTest: {
    readonly layer: (state: GitHubClientTestState) => Layer.Layer<GitHubClient>;
    readonly empty: () => Layer.Layer<GitHubClient>;
}
```
