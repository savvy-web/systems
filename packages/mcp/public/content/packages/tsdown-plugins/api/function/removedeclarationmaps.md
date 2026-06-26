---
id: packages/tsdown-plugins/api/function/removedeclarationmaps
title: "removeDeclarationMaps — tsdown-plugins function"
summary: "Remove declaration source-map files (`.d.ts.map` / `.d.cts.map`) from a built `pkg` directory, returning the removed paths. The dts pass emits these next to ea…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# removeDeclarationMaps

Remove declaration source-map files (`.d.ts.map` / `.d.cts.map`) from a built `pkg` directory, returning the removed paths. The dts pass emits these next to each `.d.ts` (the resolved dts tsconfig sets `declarationMap: true`) because API Extractor reads them during meta generation to resolve original-source positions. But they are dead weight in a PUBLISHED package — they reference `.ts` sources the tarball does not ship — and they leak local source paths, so the prod build strips them AFTER meta generation has consumed them. The dev build keeps them (it is never published, and `savvy build --target meta` reads them). Recurses, but skips `node_modules` so it does not traverse a self-contained bundle's vendored tree — only the package's own emitted declarations carry maps worth stripping.

```ts
function removeDeclarationMaps(pkgDir: string): string[];
```
