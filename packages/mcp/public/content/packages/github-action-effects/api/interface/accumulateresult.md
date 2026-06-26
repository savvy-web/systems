---
id: packages/github-action-effects/api/interface/accumulateresult
title: "AccumulateResult — github-action-effects interface"
summary: "Result of an accumulate operation."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AccumulateResult

Result of an accumulate operation.

```ts
interface AccumulateResult<A, B, E>
```

## Members

### failures

```ts
readonly failures: ReadonlyArray<{
    readonly item: A;
    readonly error: E;
  }>;
```

### successes

```ts
readonly successes: ReadonlyArray<B>;
```
