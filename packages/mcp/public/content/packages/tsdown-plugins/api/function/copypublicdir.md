---
id: packages/tsdown-plugins/api/function/copypublicdir
title: "copyPublicDir — tsdown-plugins function"
summary: "Copy the CONTENTS of `sourceDir` into `outDir`, additively. Each `sourceDir/<rel>` copies to `outDir/<rel>` — only the `public/` directory itself is dropped; t…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# copyPublicDir

Copy the CONTENTS of `sourceDir` into `outDir`, additively. Each `sourceDir/<rel>` copies to `outDir/<rel>` — only the `public/` directory itself is dropped; the substructure under it is preserved (`public/tsconfig/ecma.json` becomes `<pkg>/tsconfig/ecma.json`, NOT `<pkg>/ecma.json`). The published manifest mirrors this drop via `transformExports`, which strips a leading `public/` from export values. This function NEVER deletes: `outDir` is the shared package root that the JS/dts passes own, so deleting "files not in source" would wipe the build product. Stale-asset pruning on a non-clean rebuild is therefore out of scope (a full build's `clean: true` handles it). Collision guard: when a destination already exists, identical bytes mean a prior copy of the same asset (skipped); anything else — differing bytes, a directory where a file is needed, or a file where a parent directory is needed — means a built output occupies that path, so it throws [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) rather than clobbering it or surfacing a raw fs error.

```ts
function copyPublicDir(sourceDir: string, outDir: string): void;
```
