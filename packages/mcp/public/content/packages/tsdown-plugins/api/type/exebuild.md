---
id: packages/tsdown-plugins/api/type/exebuild
title: "ExeBuild — tsdown-plugins type"
summary: "A minimal structural type for tsdown's build, kept loose so this package keeps no tsdown runtime dep (interface-only)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ExeBuild

A minimal structural type for tsdown's build, kept loose so this package keeps no tsdown runtime dep (interface-only).

```ts
type ExeBuild = (config: unknown) => Promise<unknown>;
```
