---
id: packages/tsdown-plugins/api/function/copypublicdir
title: "copyPublicDir — tsdown-plugins function"
summary: "Flatten `sourceDir` into `outDir`, additively. `sourceDir/<rel>` copies to `outDir/<rel>` — the `public/` directory segment is dropped, so a package's staged a…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# copyPublicDir

Flatten `sourceDir` into `outDir`, additively. `sourceDir/<rel>` copies to `outDir/<rel>` — the `public/` directory segment is dropped, so a package's staged assets land at the package root (`public/ecma.json` becomes `<pkg>/ecma.json`). This function NEVER deletes: `outDir` is the shared package root that the JS/dts passes own, so deleting "files not in source" would wipe the build product. Stale-asset pruning on a non-clean rebuild is therefore out of scope (a full build's `clean: true` handles it). Collision guard: when a destination already exists, identical bytes mean a prior copy of the same asset (skipped); differing bytes mean a built output occupies that path — throws [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) rather than clobbering it.

```ts
function copyPublicDir(sourceDir: string, outDir: string): void;
```
