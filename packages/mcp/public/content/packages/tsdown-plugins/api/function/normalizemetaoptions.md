---
id: packages/tsdown-plugins/api/function/normalizemetaoptions
title: "normalizeMetaOptions — tsdown-plugins function"
summary: "Fill defaults so downstream code never branches on undefined."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# normalizeMetaOptions

Fill defaults so downstream code never branches on undefined.

```ts
function normalizeMetaOptions(meta: MetaOptions, env?: {
  CI?: string | undefined;
  GITHUB_ACTIONS?: string | undefined;
}): NormalizedMeta;
```
