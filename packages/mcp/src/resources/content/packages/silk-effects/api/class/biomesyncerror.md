---
id: packages/silk-effects/api/class/biomesyncerror
title: "BiomeSyncError — silk-effects class"
summary: "Raised when a Biome config file cannot be read or its `$schema` URL cannot be updated."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# BiomeSyncError

Raised when a Biome config file cannot be read or its `$schema` URL cannot be updated.

```ts
class BiomeSyncError extends BiomeSyncError_base<{
    readonly path: string;
    readonly reason: string;
}>
```

## Members

### message

```ts
get message(): string;
```

### path

```ts
readonly path: string;
```

### reason

```ts
readonly reason: string;
```
