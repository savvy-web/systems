---
id: packages/github-action-effects/api/variable/githubgraphqltest
title: "GitHubGraphQLTest — github-action-effects variable"
summary: "Test implementation for GitHubGraphQL."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubGraphQLTest

Test implementation for [GitHubGraphQL](silk://packages/github-action-effects/api/class/githubgraphql).

```ts
GitHubGraphQLTest: {
  readonly layer: (state: GitHubGraphQLTestState) => Layer.Layer<GitHubGraphQL>;
  readonly empty: () => {
    state: GitHubGraphQLTestState;
    layer: Layer.Layer<GitHubGraphQL>;
  };
}
```
