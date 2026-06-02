---
id: packages/github-action-effects/api/variable/automerge
title: "AutoMerge — github-action-effects variable"
summary: "Namespace for PR auto-merge operations via GitHub GraphQL API."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AutoMerge

Namespace for PR auto-merge operations via GitHub GraphQL API.

```ts
AutoMerge: {
    readonly enable: (prNodeId: string, mergeMethod?: "MERGE" | "SQUASH" | "REBASE") => Effect.Effect<void, GitHubGraphQLError, GitHubGraphQL>;
    readonly disable: (prNodeId: string) => Effect.Effect<void, GitHubGraphQLError, GitHubGraphQL>;
}
```
