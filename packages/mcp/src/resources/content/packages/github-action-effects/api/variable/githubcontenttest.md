---
id: packages/github-action-effects/api/variable/githubcontenttest
title: "GitHubContentTest — github-action-effects variable"
summary: "Test implementation for GitHubContent."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubContentTest

Test implementation for [GitHubContent](silk://packages/github-action-effects/api/class/githubcontent).

```ts
GitHubContentTest: {
    readonly layer: (state: GitHubContentTestState) => Layer.Layer<GitHubContent>;
    readonly empty: () => GitHubContentTestState;
}
```
