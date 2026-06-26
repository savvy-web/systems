---
id: packages/github-action-effects/api/interface/resilienceoptions
title: "ResilienceOptions — github-action-effects interface"
summary: "Tuning for the resilient retry/backoff applied to every GitHubClient call. Resilience is on by default; pass `{ enabled: false }` for bare, retry-free behavior…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ResilienceOptions

Tuning for the resilient retry/backoff applied to every [GitHubClient](silk://packages/github-action-effects/api/class/githubclient) call. Resilience is on by default; pass `{ enabled: false }` for bare, retry-free behavior. `maxRetries`, `baseDelay`, and `maxDelay` tune the exponential, jittered, capped backoff schedule used for retryable (429 / 5xx) errors.

```ts
interface ResilienceOptions
```

## Members

### baseDelay

```ts
readonly baseDelay?: Duration.DurationInput;
```

Base delay for the exponential schedule. Default `Duration.seconds(1)`.

### enabled

```ts
readonly enabled?: boolean;
```

Master switch. Default `true`. Set `false` for bare, retry-free behavior.

### maxDelay

```ts
readonly maxDelay?: Duration.DurationInput;
```

Cap on any single backoff delay. Default `Duration.seconds(30)`.

### maxRetries

```ts
readonly maxRetries?: number;
```

Max retry attempts for `retryable` errors. Default `4`.
