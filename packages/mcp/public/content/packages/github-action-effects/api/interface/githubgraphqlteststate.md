---
id: packages/github-action-effects/api/interface/githubgraphqlteststate
title: "GitHubGraphQLTestState — github-action-effects interface"
summary: "Test state for GitHubGraphQL."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubGraphQLTestState

Test state for [GitHubGraphQL](silk://packages/github-action-effects/api/class/githubgraphql).

```ts
interface GitHubGraphQLTestState
```

## Members

### mutationCalls

```ts
readonly mutationCalls: Array<{
    operation: string;
    query: string;
    variables?: Record<string, unknown>;
  }>;
```

### mutationResponses

```ts
readonly mutationResponses: Map<string, unknown>;
```

### queryCalls

```ts
readonly queryCalls: Array<{
    operation: string;
    query: string;
    variables?: Record<string, unknown>;
  }>;
```

### queryResponses

```ts
readonly queryResponses: Map<string, unknown>;
```
