---
id: packages/github-action-effects/api/function/resilienceschedule
title: "resilienceSchedule — github-action-effects function"
summary: "Backoff schedule for retryable GitHubClient errors: exponential, jittered, each interval capped at `maxDelay`, bounded by `maxRetries`, and gated so that only…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# resilienceSchedule

Backoff schedule for retryable [GitHubClient](silk://packages/github-action-effects/api/class/githubclient) errors: exponential, jittered, each interval capped at `maxDelay`, bounded by `maxRetries`, and gated so that only `retryable` errors recur. Non-retryable errors stop the schedule immediately. Exported for reuse by tracing spans and any future layer transformer. It is pure (depends only on `effect` and the error type) so it is safe to import from the octokit-free testing entry point. Note this differs from the internal `withResilience` (which wraps every `GitHubClient` call) in two ways: it does NOT consult a `GitHubClientError.retryAfterMs` server-advised delay, and it jitters with `Schedule.jittered` (multiplicative) rather than `withResilience`'s uniform full-jitter in `[0, capped]`. Use `Effect.retry(resilienceSchedule(...))` for a standalone backoff; reach for `withResilience` directly when server-advised `Retry-After` / `x-ratelimit-reset` delays must be honored. The per-interval cap is expressed with `Schedule.map((d) => Duration.min(d, cap))` rather than `Schedule.either(Schedule.spaced(cap))`: `Duration.min` caps each computed delay deterministically, which the cap test pins directly.

```ts
resilienceSchedule: (options?: ResilienceOptions) => Schedule.Schedule<unknown, GitHubClientError>
```
