---
id: packages/tsdown-plugins/api/interface/resolvedtarget
title: "ResolvedTarget — tsdown-plugins interface"
summary: "A resolved registry target (one per `publishConfig.targets` key)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ResolvedTarget

A resolved registry target (one per `publishConfig.targets` key).

```ts
interface ResolvedTarget
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

The `publishConfig.targets` key.

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
