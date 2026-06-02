---
id: packages/github-action-effects/api/variable/githubclientlive
title: "GitHubClientLive — github-action-effects variable"
summary: "Live `GitHubClient` layer constructors."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubClientLive

Live `GitHubClient` layer constructors.

```ts
GitHubClientLive: {
    readonly fromEnv: (resilience?: ResilienceOptions) => Layer.Layer<GitHubClient, GitHubClientError>;
    readonly fromToken: (token: Redacted.Redacted<string>, resilience?: ResilienceOptions) => Layer.Layer<GitHubClient>;
    readonly fromApp: (options: {
        clientId: string;
        privateKey: Redacted.Redacted<string>;
        installationId?: number;
    }, resilience?: ResilienceOptions) => Layer.Layer<GitHubClient, GitHubAppError, HttpClient.HttpClient>;
}
```
