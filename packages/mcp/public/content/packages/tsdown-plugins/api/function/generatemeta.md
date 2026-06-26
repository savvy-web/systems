---
id: packages/tsdown-plugins/api/function/generatemeta
title: "generateMeta — tsdown-plugins function"
summary: "Generate the api-model meta bundle from already-emitted .d.ts. Writes tsdoc.json (idempotent), runs the extractor per entry, merges if needed, and writes the \"…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# generateMeta

Generate the api-model meta bundle from already-emitted .d.ts. Writes tsdoc.json (idempotent), runs the extractor per entry, merges if needed, and writes the "virtual TS env" trio to outMetaDir (`<unscoped>.api.json` + the final `package.json` + a portable `tsconfig.json`), copying that trio into each localPaths dir. The api-extractor `tsdoc-metadata.json` is a published-package artifact and is written into `dtsDir` (the built pkg/), not the meta bundle.

```ts
function generateMeta(options: GenerateMetaOptions): Promise<MetaResult>;
```
