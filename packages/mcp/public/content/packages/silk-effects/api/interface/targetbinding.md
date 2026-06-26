---
id: packages/silk-effects/api/interface/targetbinding
title: "TargetBinding — silk-effects interface"
summary: "A resolved registry target from the bundler's `dist/prod/targets.json` binding (one per `publishConfig.targets` key)."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# TargetBinding

A resolved registry target from the bundler's `dist/prod/targets.json` binding (one per `publishConfig.targets` key).

```ts
interface TargetBinding
```

## Members

### group

```ts
readonly group: string;
```

The group id whose bytes this target deploys.

### id

```ts
readonly id: string;
```

The `publishConfig.targets` key (`npm`, `github`, …).

### name

```ts
readonly name: string;
```

The resolved name for that group.

### registry

```ts
readonly registry: string;
```

The resolved registry endpoint.
