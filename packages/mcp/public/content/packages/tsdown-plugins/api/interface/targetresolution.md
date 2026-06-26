---
id: packages/tsdown-plugins/api/interface/targetresolution
title: "TargetResolution — tsdown-plugins interface"
summary: "The full resolution of `publishConfig.targets`: the distinct groups to build, and every target bound to one."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# TargetResolution

The full resolution of `publishConfig.targets`: the distinct groups to build, and every target bound to one.

```ts
interface TargetResolution
```

## Members

### groups

```ts
readonly groups: ReadonlyArray<ResolvedGroup>;
```

### targets

```ts
readonly targets: ReadonlyArray<ResolvedTarget>;
```
