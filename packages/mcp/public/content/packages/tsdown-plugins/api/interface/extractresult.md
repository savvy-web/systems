---
id: packages/tsdown-plugins/api/interface/extractresult
title: "ExtractResult — tsdown-plugins interface"
summary: "interface ExtractResult from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ExtractResult

```ts
interface ExtractResult
```

## Members

### entries

```ts
readonly entries: Record<string, string>;
```

entry name to TS source path

### exportPaths

```ts
readonly exportPaths: Record<string, string>;
```

entry name to original export key (for downstream output-map alignment)
