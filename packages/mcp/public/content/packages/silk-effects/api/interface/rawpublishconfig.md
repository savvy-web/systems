---
id: packages/silk-effects/api/interface/rawpublishconfig
title: "RawPublishConfig — silk-effects interface"
summary: "Raw `publishConfig` shape (the unschematized fields silk rules consult)."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# RawPublishConfig

Raw `publishConfig` shape (the unschematized fields silk rules consult).

```ts
interface RawPublishConfig
```

## Members

### access

```ts
readonly access?: "public" | "restricted";
```

### directory

```ts
readonly directory?: string;
```

### registry

```ts
readonly registry?: string;
```

### targets

```ts
readonly targets?: RawPublishTargets;
```
