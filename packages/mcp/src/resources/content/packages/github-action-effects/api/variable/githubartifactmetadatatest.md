---
id: packages/github-action-effects/api/variable/githubartifactmetadatatest
title: "GitHubArtifactMetadataTest — github-action-effects variable"
summary: "Test implementation for `GitHubArtifactMetadata`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubArtifactMetadataTest

Test implementation for `GitHubArtifactMetadata`.

```ts
GitHubArtifactMetadataTest: {
    readonly layer: (state: GitHubArtifactMetadataTestState) => Layer.Layer<GitHubArtifactMetadata>;
    readonly empty: () => {
        state: GitHubArtifactMetadataTestState;
        layer: Layer.Layer<GitHubArtifactMetadata>;
    };
}
```
