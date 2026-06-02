---
id: packages/github-action-effects/api/variable/ratelimitstatus
title: "RateLimitStatus — github-action-effects variable"
summary: "Schema for GitHub API rate limit status."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RateLimitStatus

Schema for GitHub API rate limit status.

```ts
RateLimitStatus: Schema.Struct<{
    limit: typeof Schema.Number;
    remaining: typeof Schema.Number;
    reset: typeof Schema.Number;
    used: typeof Schema.Number;
}>
```
