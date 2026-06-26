---
id: packages/tsdown-plugins/api/interface/formatter
title: "Formatter — tsdown-plugins interface"
summary: "interface Formatter from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# Formatter

```ts
interface Formatter
```

## Members

### format

```ts
readonly format: string;
```

### render

```ts
readonly render: (reports: ReadonlyArray<BuildReport>, ctx: FormatterContext) => ReadonlyArray<RenderedOutput>;
```
