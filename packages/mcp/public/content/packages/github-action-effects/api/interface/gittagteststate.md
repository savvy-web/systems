---
id: packages/github-action-effects/api/interface/gittagteststate
title: "GitTagTestState — github-action-effects interface"
summary: "Test state for GitTag."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitTagTestState

Test state for [GitTag](silk://packages/github-action-effects/api/class/gittag).

```ts
interface GitTagTestState
```

## Members

### createCalls

```ts
readonly createCalls: Array<{
    tag: string;
    sha: string;
  }>;
```

### deleteCalls

```ts
readonly deleteCalls: Array<string>;
```

### tags

```ts
readonly tags: Map<string, string>;
```
