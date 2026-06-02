---
id: packages/github-action-effects/api/interface/githubclientteststate
title: "GitHubClientTestState — github-action-effects interface"
summary: "Test state for GitHubClient."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubClientTestState

Test state for [GitHubClient](silk://packages/github-action-effects/api/class/githubclient).

```ts
interface GitHubClientTestState
```

## Members

### graphqlResponses

```ts
readonly graphqlResponses: Map<string, unknown>;
```

### paginateResponses

```ts
readonly paginateResponses: Map<string, Array<unknown[]>>;
```

### repo

```ts
readonly repo: {
        owner: string;
        repo: string;
    };
```

### restResponses

```ts
readonly restResponses: Map<string, RestResponse>;
```
