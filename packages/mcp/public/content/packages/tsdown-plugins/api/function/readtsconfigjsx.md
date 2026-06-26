---
id: packages/tsdown-plugins/api/function/readtsconfigjsx
title: "readTsconfigJsx — tsdown-plugins function"
summary: "Read the jsx-relevant compilerOptions from a package's own tsconfig.json (best-effort; returns empty on absence or parse error)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# readTsconfigJsx

Read the jsx-relevant compilerOptions from a package's own tsconfig.json (best-effort; returns empty on absence or parse error).

```ts
function readTsconfigJsx(cwd: string): TsconfigJsx;
```
