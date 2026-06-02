---
id: packages/github-action-effects/api/variable/ratelimitertest
title: "RateLimiterTest — github-action-effects variable"
summary: "Test implementation for RateLimiter."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RateLimiterTest

Test implementation for [RateLimiter](silk://packages/github-action-effects/api/class/ratelimiter).

```ts
RateLimiterTest: {
    readonly layer: (state: RateLimiterTestState) => Layer.Layer<RateLimiter>;
    readonly empty: () => RateLimiterTestState;
}
```
