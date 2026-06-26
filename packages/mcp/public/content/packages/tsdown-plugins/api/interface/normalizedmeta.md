---
id: packages/tsdown-plugins/api/interface/normalizedmeta
title: "NormalizedMeta — tsdown-plugins interface"
summary: "Fully-resolved meta options (no optionals)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# NormalizedMeta

Fully-resolved meta options (no optionals).

```ts
interface NormalizedMeta
```

## Members

### localPaths

```ts
readonly localPaths: ReadonlyArray<string>;
```

### optimistic

```ts
readonly optimistic: boolean;
```

### tsdoc

```ts
readonly tsdoc: {
    readonly suppressWarnings: ReadonlyArray<WarningSuppressionRule>;
    readonly tagDefinitions: ReadonlyArray<TsdocTagDefinition>;
  };
```
