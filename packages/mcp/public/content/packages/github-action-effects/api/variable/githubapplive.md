---
id: packages/github-action-effects/api/variable/githubapplive
title: "GitHubAppLive — github-action-effects variable"
summary: "Live implementation of GitHubApp using octokit auth-app and the `@effect/platform` `HttpClient`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubAppLive

Live implementation of [GitHubApp](silk://packages/github-action-effects/api/class/githubapp) using octokit auth-app and the `@effect/platform` `HttpClient`.

```ts
GitHubAppLive: Layer.Layer<GitHubApp, never, OctokitAuthApp | HttpClient.HttpClient>
```
