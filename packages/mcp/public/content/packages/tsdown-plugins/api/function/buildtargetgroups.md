---
id: packages/tsdown-plugins/api/function/buildtargetgroups
title: "buildTargetGroups — tsdown-plugins function"
summary: "Run tsdown.build() per TargetGroup. Composable so the escape hatch gets multi-group too. Each group runs TWO passes to the SAME outDir: 1. JS pass — per-module…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# buildTargetGroups

Run tsdown.build() per TargetGroup. Composable so the escape hatch gets multi-group too. Each group runs TWO passes to the SAME outDir: 1. JS pass — per-module JS (`unbundle: true`, `dts: false`), with the `emitManifest` plugin and the `public/` copy. Default `clean: true` gives it a fresh outDir. 2. dts pass — bundled declarations only (`unbundle: false`, `dts: { emitDtsOnly: true }`, `clean: false`). No manifest plugin, no copy, no sourcemaps. `clean: false` is load-bearing: it must NOT wipe the JS the first pass just wrote. Why two passes: tsdown's `unbundle` maps to rolldown `output.preserveModules` for the whole build (JS and the dts plugin share it), so a single pass cannot give per-module JS + bundled dts. Per-module dts breaks type portability (TS2883); bundling the JS re-bundles workspace consumers. The split keeps per-module JS AND rolled-up, self-contained declarations.

```ts
function buildTargetGroups(options: BuildTargetGroupsOptions): Promise<void>;
```
