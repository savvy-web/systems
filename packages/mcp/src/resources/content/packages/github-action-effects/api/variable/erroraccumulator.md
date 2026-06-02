---
id: packages/github-action-effects/api/variable/erroraccumulator
title: "ErrorAccumulator — github-action-effects variable"
summary: "Namespace for error-accumulating operations. Processes all items and collects both successes and failures without short-circuiting on first error."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ErrorAccumulator

Namespace for error-accumulating operations. Processes all items and collects both successes and failures without short-circuiting on first error.

```ts
ErrorAccumulator: {
    readonly forEachAccumulate: <A, B, E, R>(items: Iterable<A>, fn: (item: A) => Effect.Effect<B, E, R>) => Effect.Effect<AccumulateResult<A, B, E>, never, R>;
    readonly forEachAccumulateConcurrent: <A, B, E, R>(items: Iterable<A>, fn: (item: A) => Effect.Effect<B, E, R>, concurrency: number) => Effect.Effect<AccumulateResult<A, B, E>, never, R>;
}
```
