---
id: packages/tsdown-plugins/api/interface/cssoptions
title: "CssOptions — tsdown-plugins interface"
summary: "CSS handling for a partition's JS pass, forwarded VERBATIM to tsdown's `css` option (consumed by `@tsdown/css`). Structurally typed so tsdown-plugins takes no…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# CssOptions

CSS handling for a partition's JS pass, forwarded VERBATIM to tsdown's `css` option (consumed by `@tsdown/css`). Structurally typed so tsdown-plugins takes no dependency on `@tsdown/css`. The package whose runtime is built must install `@tsdown/css`; tsdown loads it lazily.

```ts
interface CssOptions
```

## Members

### (indexer)

```ts
readonly [k: string]: unknown;
```

### modules

```ts
readonly modules?: boolean | {
    readonly localsConvention?: string;
    readonly namedExport?: boolean;
    readonly [k: string]: unknown;
  };
```
