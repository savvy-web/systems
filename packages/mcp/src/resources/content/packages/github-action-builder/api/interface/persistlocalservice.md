---
id: packages/github-action-builder/api/interface/persistlocalservice
title: "PersistLocalService — github-action-builder interface"
summary: "PersistLocalService interface for copying build output locally."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# PersistLocalService

[PersistLocalService](silk://packages/github-action-builder/api/variable/persistlocalservice) interface for copying build output locally.

```ts
interface PersistLocalService
```

## Members

### formatResult

```ts
readonly formatResult: (result: PersistLocalResult) => string;
```

Format persist result for display.

### persist

```ts
readonly persist: (config: Config, options?: PersistLocalRunnerOptions) => Effect.Effect<PersistLocalResult, PersistLocalError |
  ActionYmlPathError>;
```

Persist build output to the local action directory.
