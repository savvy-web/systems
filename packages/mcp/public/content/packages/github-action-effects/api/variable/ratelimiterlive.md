---
id: packages/github-action-effects/api/variable/ratelimiterlive
title: "RateLimiterLive — github-action-effects variable"
summary: "Rate limiter that reads the `x-ratelimit-*` headers observed on real responses (cached in a shared `RateLimitState` `Ref` written by the GitHubClient), rather…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RateLimiterLive

Rate limiter that reads the `x-ratelimit-*` headers observed on real responses (cached in a shared `RateLimitState` `Ref` written by the [GitHubClient](silk://packages/github-action-effects/api/class/githubclient)), rather than issuing a pre-flight `GET /rate_limit` before every guarded call. Probes only on a cache miss.

```ts
RateLimiterLive: Layer.Layer<RateLimiter, never, GitHubClient>
```
