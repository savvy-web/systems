---
id: packages/tsdown-plugins/api/interface/tsdocoptions
title: "TsdocOptions — tsdown-plugins interface"
summary: "TSDoc / doc-warning configuration. suppressWarnings is doc functionality, so it lives here."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# TsdocOptions

TSDoc / doc-warning configuration. suppressWarnings is doc functionality, so it lives here.

```ts
interface TsdocOptions
```

## Members

### suppressWarnings

```ts
readonly suppressWarnings?: ReadonlyArray<WarningSuppressionRule> | undefined;
```

### tagDefinitions

```ts
readonly tagDefinitions?: ReadonlyArray<TsdocTagDefinition> | undefined;
```
