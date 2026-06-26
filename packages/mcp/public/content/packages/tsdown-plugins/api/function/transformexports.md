---
id: packages/tsdown-plugins/api/function/transformexports
title: "transformExports — tsdown-plugins function"
summary: "Rewrite an exports map: TS string targets become a types/import conditions object. Each TS condition also gets a `require` entry when `dual` is `true` (uniform…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# transformExports

Rewrite an exports map: TS string targets become a types/import conditions object. Each TS condition also gets a `require` entry when `dual` is `true` (uniform) or when the export key is in the `dual` Set (per-entry). The output path is derived from the export KEY via the shared entry-name function, never from the source path, so the manifest target always matches the emitted file. Export keys in `subdirExports` are built into an isolated `<key>/index.*` subdir (e.g. an RSPress `./runtime`), so their conditions gain an `/index` segment.

```ts
function transformExports(exports: unknown, dual?: DualExports, subdirExports?: ReadonlySet<string>): unknown;
```
