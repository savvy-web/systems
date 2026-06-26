---
id: packages/silk-effects/api/interface/targetsbinding
title: "TargetsBinding — silk-effects interface"
summary: "The `dist/prod/targets.json` binding the bundler emits for the release action to consume."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# TargetsBinding

The `dist/prod/targets.json` binding the bundler emits for the release action to consume.

```ts
interface TargetsBinding
```

## Members

### groups

```ts
readonly groups: ReadonlyArray<TargetGroupBinding>;
```

### targets

```ts
readonly targets: ReadonlyArray<TargetBinding>;
```
