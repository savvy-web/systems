---
id: packages/github-action-effects/api/variable/githubreleasetest
title: "GitHubReleaseTest — github-action-effects variable"
summary: "Test implementation for GitHubRelease."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubReleaseTest

Test implementation for [GitHubRelease](silk://packages/github-action-effects/api/class/githubrelease).

```ts
GitHubReleaseTest: {
    readonly layer: (state: GitHubReleaseTestState) => Layer.Layer<GitHubRelease>;
    readonly empty: () => {
        state: GitHubReleaseTestState;
        layer: Layer.Layer<GitHubRelease>;
    };
}
```
