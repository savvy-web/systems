---
id: packages/tsdown-plugins/api/interface/normalizedexe
title: "NormalizedExe — tsdown-plugins interface"
summary: "Fully-resolved SEA binary spec (no optionals)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# NormalizedExe

Fully-resolved SEA binary spec (no optionals).

```ts
interface NormalizedExe
```

## Members

### entry

```ts
readonly entry: string;
```

### fileName

```ts
readonly fileName: string;
```

### seaConfig

```ts
readonly seaConfig: {
    readonly disableExperimentalSEAWarning: boolean;
    readonly useCodeCache: boolean;
    readonly useSnapshot: boolean;
  };
```

### targets

```ts
readonly targets: ReadonlyArray<ExeTarget>;
```
