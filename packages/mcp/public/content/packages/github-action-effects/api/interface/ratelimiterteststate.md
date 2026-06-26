---
id: packages/github-action-effects/api/interface/ratelimiterteststate
title: "RateLimiterTestState — github-action-effects interface"
summary: "Test state for RateLimiter."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RateLimiterTestState

Test state for [RateLimiter](silk://packages/github-action-effects/api/class/ratelimiter).

```ts
interface RateLimiterTestState
```

## Members

### checkGraphQLCalls

```ts
readonly checkGraphQLCalls: Array<void>;
```

### checkRestCalls

```ts
readonly checkRestCalls: Array<void>;
```

### graphqlStatus

```ts
graphqlStatus: RateLimitStatus;
```

### restStatus

```ts
restStatus: RateLimitStatus;
```
