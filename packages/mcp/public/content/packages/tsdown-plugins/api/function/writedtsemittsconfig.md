---
id: packages/tsdown-plugins/api/function/writedtsemittsconfig
title: "writeDtsEmitTsconfig — tsdown-plugins function"
summary: "Derive a dts-EMIT variant of an already-written resolved tsconfig that adds `stableTypeOrdering: true`, and return its path. This makes the TypeScript declarat…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# writeDtsEmitTsconfig

Derive a dts-EMIT variant of an already-written resolved tsconfig that adds `stableTypeOrdering: true`, and return its path. This makes the TypeScript declaration emitter (rolldown-plugin-dts on `typescript@6`) order union/type members deterministically, so a multi-union `.d.ts` (e.g. an Effect `Layer.Layer<…>` requirement channel) does not flip member order across otherwise-identical builds (#156). It is kept in a SEPARATE file from the api-extractor tsconfig on purpose: `@microsoft/api-extractor` pins `typescript ~5.9`, which predates the flag and hard-errors on the unknown compiler option — so only the emit passes (which run on TS6) ever see it, while the api-extractor compile reads the original clean config. Best-effort: if the base tsconfig cannot be read or parsed (e.g. a synthetic test path that was never written), the original path is returned unchanged — the emit then simply keeps TS's default ordering rather than aborting the build at this layer.

```ts
function writeDtsEmitTsconfig(resolvedTsconfigPath: string): string;
```
